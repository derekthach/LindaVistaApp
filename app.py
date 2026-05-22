from flask import Flask, render_template, request, redirect, url_for, send_file, session, jsonify
import sqlite3
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
import csv
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Secret key for sessions

# Flask login credentials (set in production). See README or docstring below.
# Env vars: FLASK_ADMIN_USER, FLASK_ADMIN_PASS, FLASK_EMP_USER, FLASK_EMP_PASS
FLASK_ADMIN_USER = os.environ.get('FLASK_ADMIN_USER', 'admin')
FLASK_ADMIN_PASS = os.environ.get('FLASK_ADMIN_PASS', 'password')
FLASK_EMP_USER = os.environ.get('FLASK_EMP_USER', 'employee')
FLASK_EMP_PASS = os.environ.get('FLASK_EMP_PASS', 'employee123')

PR_TZ = ZoneInfo('America/Puerto_Rico')


def _pr_today() -> date:
    """Calendar date in Puerto Rico (business reporting day)."""
    return datetime.now(PR_TZ).date()


def _motel_week_start(today: date) -> date:
    """Motel business week (Fri–Thu): most recent Friday (Mon=0 … Fri=4)."""
    wd = today.weekday()
    days_since_fri = (wd - 4) % 7
    return today - timedelta(days=days_since_fri)


# Selectable rooms for legacy Flask check-in — keep in sync with src/lib/checkins/rooms.ts ROOM_OPTIONS
def _room_select_options_filtered():
    rooms = []
    for n in range(1, 14):
        if 4 <= n <= 13:
            continue
        rooms.append(n)
    rooms.extend(['14A', '14B', '15A', '15B'])
    for n in range(16, 51):
        if 30 <= n <= 37:
            continue
        if n in (39, 49, 50):
            continue
        rooms.append(n)
    return rooms


ROOM_SELECT_OPTIONS = tuple(_room_select_options_filtered())

# Initialize the database
def init_db():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Create Rooms table if it doesn't exist
    c.execute('''CREATE TABLE IF NOT EXISTS Rooms (
                    room_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL
                )''')
                
    # Create CheckIns table with updated schema
    c.execute('''CREATE TABLE IF NOT EXISTS CheckIns (
                    checkin_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_number TEXT,                    
                    date TEXT,
                    time TEXT,
                    room_id TEXT,
                    cost REAL,
                    payment_method TEXT,
                    staff_name TEXT,
                    car_plate TEXT,
                    car_make TEXT,
                    car_color TEXT,
                    note TEXT,
                    FOREIGN KEY(room_id) REFERENCES Rooms(room_id)
                )''')
    
    # Create a settings table to store the next receipt number
    c.execute('''CREATE TABLE IF NOT EXISTS Settings (
                    setting_name TEXT PRIMARY KEY,
                    setting_value TEXT
                )''')
    
    # Check if we already have a next_receipt_number setting
    c.execute('SELECT setting_value FROM Settings WHERE setting_name = "next_receipt_number"')
    result = c.fetchone()
    
    # If not, initialize it to "0001"
    if not result:
        c.execute('INSERT INTO Settings (setting_name, setting_value) VALUES (?, ?)',
                 ("next_receipt_number", "0001"))
    
    # Check if we need to insert initial rooms (only if Rooms is empty)
    c.execute('SELECT COUNT(*) FROM Rooms')
    room_count = c.fetchone()[0]
    
    # Only populate rooms if the table is empty
    if room_count == 0:
        c.executemany(
            'INSERT INTO Rooms (room_id, status) VALUES (?, ?)',
            [(str(rid), 'Available') for rid in ROOM_SELECT_OPTIONS],
        )
        
    conn.commit()
    conn.close()

# Initialize the database on first run only
init_db()

@app.route('/')
def home():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
    
    # Employees should be redirected to check-in page
    if session.get('role') == 'employee':
        return redirect(url_for('checkin'))
    
    cars_today = get_cars_today()
    cars_this_week = get_cars_this_week()
    profit_today = get_profit_today()
    profit_this_week = get_profit_this_week()
    return render_template('index.html', 
                          cars_today=cars_today, 
                          cars_this_week=cars_this_week, 
                          profit_today=profit_today, 
                          profit_this_week=profit_this_week,
                          logged_in=True,
                          role=session.get('role'))

@app.route('/checkin', methods=['GET', 'POST'])
def checkin():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
        
    if request.method == 'POST':
        # Collect form data
        form_data = {
            'room_id': request.form['room_id'],
            'receipt_number': request.form['receipt_number'],
            'date': request.form['date'],
            'cost': request.form['cost'],
            'payment_method': request.form['payment_method'],
            'time': request.form['time'],
            'car_plate': request.form['car_plate'],
            'car_make': request.form['car_make'],
            'car_color': request.form['car_color'],
            'staff_name': request.form['staff_name'],
            'note': request.form.get('note', '')
        }
        # Redirect to the summary page with form data
        return render_template('verify_form.html', 
                              logged_in=True,
                              role=session.get('role'),
                              **form_data)
    return render_template(
        'checkin.html',
        logged_in=True,
        role=session.get('role'),
        room_options=ROOM_SELECT_OPTIONS,
    )

@app.route('/view_checkins')
def view_checkins():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
    
    # Employees should not have access to view all check-ins
    if session.get('role') == 'employee':
        return redirect(url_for('checkin'))
    
    # Get date range filter parameters from request
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
        
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Apply date filters if they exist
    if start_date and end_date:
        c.execute('SELECT * FROM CheckIns WHERE date BETWEEN ? AND ? ORDER BY date DESC', (start_date, end_date))
    elif start_date:
        c.execute('SELECT * FROM CheckIns WHERE date >= ? ORDER BY date DESC', (start_date,))
    elif end_date:
        c.execute('SELECT * FROM CheckIns WHERE date <= ? ORDER BY date DESC', (end_date,))
    else:
        c.execute('SELECT * FROM CheckIns ORDER BY date DESC')
        
    checkins = c.fetchall()
    conn.close()
    
    return render_template('view_checkins.html', 
                          checkins=checkins,
                          logged_in=True,
                          role=session.get('role'))

@app.route('/export_checkins')
def export_checkins():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
    
    # Employees should not have access to export data
    if session.get('role') == 'employee':
        return redirect(url_for('checkin'))
    
    # Get date range filter parameters from request
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
        
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Apply date filters if they exist
    if start_date and end_date:
        c.execute('SELECT checkin_id, date, time, receipt_number, room_id, staff_name, car_plate, cost, note FROM CheckIns WHERE date BETWEEN ? AND ? ORDER BY date DESC', (start_date, end_date))
    elif start_date:
        c.execute('SELECT checkin_id, date, time, receipt_number, room_id, staff_name, car_plate, cost, note FROM CheckIns WHERE date >= ? ORDER BY date DESC', (start_date,))
    elif end_date:
        c.execute('SELECT checkin_id, date, time, receipt_number, room_id, staff_name, car_plate, cost, note FROM CheckIns WHERE date <= ? ORDER BY date DESC', (end_date,))
    else:
        c.execute('SELECT checkin_id, date, time, receipt_number, room_id, staff_name, car_plate, cost, note FROM CheckIns ORDER BY date DESC')
        
    rows = c.fetchall()
    conn.close()

    # Generate a filename with the date range if filtering
    filename = 'checkins_export'
    if start_date and end_date:
        filename += f'_{start_date}_to_{end_date}'
    elif start_date:
        filename += f'_from_{start_date}'
    elif end_date:
        filename += f'_until_{end_date}'
    filename += '.csv'

    # Write to CSV
    with open(filename, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['Check-In ID', 'Date', 'Time', 'Receipt Number', 'Room ID', 'Staff Name', 'Car Plate', 'Cost', 'Notes'])
        csvwriter.writerows(rows)

    return send_file(filename, as_attachment=True)

def get_cars_today():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = _pr_today().isoformat()
    c.execute('SELECT COUNT(*) FROM CheckIns WHERE date = ?', (today,))
    cars_today = c.fetchone()[0]
    conn.close()
    return cars_today


def get_cars_this_week():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = _pr_today()
    start_of_week = _motel_week_start(today)
    c.execute('SELECT COUNT(*) FROM CheckIns WHERE date BETWEEN ? AND ?', (start_of_week.isoformat(), today.isoformat()))
    cars_this_week = c.fetchone()[0]
    conn.close()
    return cars_this_week


def get_profit_today():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = _pr_today().isoformat()
    c.execute('SELECT SUM(cost) FROM CheckIns WHERE date = ?', (today,))
    profit_today = c.fetchone()[0] or 0
    conn.close()
    return profit_today


def get_profit_this_week():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = _pr_today()
    start_of_week = _motel_week_start(today)
    c.execute('SELECT SUM(cost) FROM CheckIns WHERE date BETWEEN ? AND ?', (start_of_week.isoformat(), today.isoformat()))
    profit_this_week = c.fetchone()[0] or 0
    conn.close()
    return profit_this_week


@app.route('/dashboard')
def dashboard():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
    
    # Employees should not have access to the dashboard
    if session.get('role') == 'employee':
        return redirect(url_for('checkin'))
        
    cars_today = get_cars_today()
    cars_this_week = get_cars_this_week()
    profit_today = get_profit_today()
    profit_this_week = get_profit_this_week()
    return render_template('index.html', 
                          cars_today=cars_today, 
                          cars_this_week=cars_this_week, 
                          profit_today=profit_today, 
                          profit_this_week=profit_this_week,
                          logged_in=True,
                          role=session.get('role'))

@app.route('/confirm_checkin', methods=['POST'])
def confirm_checkin():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
    
    # Collect form data
    form_data = dict(request.form)
    
    # Format receipt number
    if 'receipt_number' in form_data and form_data['receipt_number']:
        # Remove non-digits and format to 4 digits
        receipt_number = ''.join(c for c in form_data['receipt_number'] if c.isdigit())
        form_data['receipt_number'] = receipt_number.zfill(4)
        
        # Calculate next receipt number (current + 1)
        try:
            next_receipt = str(int(receipt_number) + 1).zfill(4)
        except:
            next_receipt = "0001"  # Fallback
    else:
        # Use default if empty
        form_data['receipt_number'] = "0001"
        next_receipt = "0002"
    
    print(f"Using receipt number: {form_data['receipt_number']}")
    print(f"Next receipt will be: {next_receipt}")
    
    # Update database in a transaction
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    try:
        # Start transaction
        c.execute('BEGIN TRANSACTION')
        
        # Insert check-in
        c.execute('''
            INSERT INTO CheckIns (room_id, receipt_number, date, time, cost, payment_method, 
                                car_plate, car_make, car_color, staff_name, note)
            VALUES (:room_id, :receipt_number, :date, :time, :cost, :payment_method, 
                   :car_plate, :car_make, :car_color, :staff_name, :note)
        ''', form_data)
        
        # Update next receipt number
        c.execute('UPDATE Settings SET setting_value = ? WHERE setting_name = "next_receipt_number"',
                 (next_receipt,))
        
        # Commit transaction
        c.execute('COMMIT')
        
        print(f"Transaction successful. Next receipt updated to {next_receipt}")
    except Exception as e:
        # Rollback on error
        c.execute('ROLLBACK')
        print(f"Error in transaction: {e}")
    finally:
        conn.close()
    
    # Redirect to the checkin page
    return redirect(url_for('checkin'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Authentication logic (credentials from env; defaults for local dev)
        if username == FLASK_ADMIN_USER and password == FLASK_ADMIN_PASS:
            session['logged_in'] = True
            session['username'] = username
            session['role'] = 'admin'  # Admin role with full access
            return redirect(url_for('dashboard'))
        elif username == FLASK_EMP_USER and password == FLASK_EMP_PASS:
            session['logged_in'] = True
            session['username'] = username
            session['role'] = 'employee'  # Employee role with limited access
            return redirect(url_for('checkin'))
        else:
            return render_template('login.html', error='Invalid credentials')
    
    return render_template('login.html', logged_in=session.get('logged_in', False))

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username', None)
    session.pop('role', None)
    return redirect(url_for('login'))

@app.route('/api/dashboard-data')
def dashboard_data():
    if not session.get('logged_in', False):
        return jsonify({'error': 'Not authorized'}), 401
    
    # Only admins should access this data
    if session.get('role') != 'admin':
        return jsonify({'error': 'Not authorized'}), 403
    
    # Rolling last 7 calendar days in Puerto Rico (same semantics as Next.js get7DayTrends).
    end_d = _pr_today()
    start_d = end_d - timedelta(days=6)

    dates = []
    checkins_data = []
    revenue_data = []

    current_d = start_d
    while current_d <= end_d:
        dates.append(current_d.isoformat())
        current_d += timedelta(days=1)
    
    # Fetch data for each date
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    for date in dates:
        # Count check-ins for this date
        c.execute('SELECT COUNT(*) FROM CheckIns WHERE date = ?', (date,))
        count = c.fetchone()[0]
        checkins_data.append(count)
        
        # Sum revenue for this date
        c.execute('SELECT SUM(cost) FROM CheckIns WHERE date = ?', (date,))
        revenue = c.fetchone()[0] or 0  # Use 0 if NULL
        revenue_data.append(revenue)
    
    conn.close()
    
    display_dates = [datetime.strptime(date, '%Y-%m-%d').strftime('%m/%d') for date in dates]
    
    return jsonify({
        'dates': display_dates,
        'checkins': checkins_data,
        'revenue': revenue_data
    })

@app.route('/api/room-usage-data')
def room_usage_data():
    if not session.get('logged_in', False):
        return jsonify({'error': 'Not authorized'}), 401
    
    # Only admins should access this data
    if session.get('role') != 'admin':
        return jsonify({'error': 'Not authorized'}), 403
    
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Get room usage frequency - top 10 rooms to keep it compact
    c.execute('''
        SELECT room_id, COUNT(*) as usage_count
        FROM CheckIns
        GROUP BY room_id
        ORDER BY usage_count DESC
        LIMIT 10
    ''')
    
    results = c.fetchall()
    conn.close()
    
    room_numbers = [f"Room {row[0]}" for row in results]
    usage_counts = [row[1] for row in results]
    
    return jsonify({
        'room_numbers': room_numbers,
        'usage_counts': usage_counts
    })

@app.route('/api/next-receipt-number', methods=['GET'])
def next_receipt_number():
    if not session.get('logged_in', False):
        return jsonify({'error': 'Not authorized'}), 401
    
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Get the next receipt number from settings table
    c.execute('SELECT setting_value FROM Settings WHERE setting_name = "next_receipt_number"')
    result = c.fetchone()
    
    # Default to "0001" if not found (shouldn't happen)
    next_receipt = result[0] if result else "0001"
    
    conn.close()
    
    print(f"API returning next receipt number: {next_receipt}")
    return jsonify({'next_receipt_number': next_receipt})

@app.route('/api/monthly-revenue', methods=['GET'])
def monthly_revenue():
    if not session.get('logged_in', False):
        return jsonify({'error': 'Not authorized'}), 401
    
    # Only admins should access this data
    if session.get('role') != 'admin':
        return jsonify({'error': 'Not authorized'}), 403
    
    # Get selected month and year from request
    try:
        month = int(request.args.get('month', datetime.now().month))
        year = int(request.args.get('year', datetime.now().year))
        
        # Validation
        if month < 1 or month > 12:
            month = datetime.now().month
        
        # Simple validation for year (adjust range as needed)
        current_year = datetime.now().year
        if year < 2000 or year > current_year + 10:
            year = current_year
            
    except ValueError:
        # Default to current month/year if conversion fails
        month = datetime.now().month
        year = datetime.now().year
    
    # Calculate previous month and year
    prev_month = month - 1
    prev_year = year
    
    if prev_month == 0:
        prev_month = 12
        prev_year = year - 1
    
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Format the date ranges - IMPORTANT! Ensure proper formatting
    current_month_start = f"{year}-{month:02d}-01"
    
    # Calculate the next month's start date
    if month == 12:
        next_month_start = f"{year+1}-01-01"
    else:
        next_month_start = f"{year}-{month+1:02d}-01"
    
    # Get total revenue for current month
    c.execute('SELECT SUM(cost) FROM CheckIns WHERE date >= ? AND date < ?', 
              (current_month_start, next_month_start))
    current_month_revenue = c.fetchone()[0] or 0
    
    # Get car count for current month
    c.execute('SELECT COUNT(*) FROM CheckIns WHERE date >= ? AND date < ?', 
              (current_month_start, next_month_start))
    current_month_cars = c.fetchone()[0]
    
    # Previous month data
    prev_month_start = f"{prev_year}-{prev_month:02d}-01"
    
    # Get total revenue for previous month
    c.execute('SELECT SUM(cost) FROM CheckIns WHERE date >= ? AND date < ?', 
              (prev_month_start, current_month_start))
    prev_month_revenue = c.fetchone()[0] or 0
    
    # Get car count for previous month
    c.execute('SELECT COUNT(*) FROM CheckIns WHERE date >= ? AND date < ?', 
              (prev_month_start, current_month_start))
    prev_month_cars = c.fetchone()[0]
    
    # Get all years that have data
    c.execute('SELECT DISTINCT substr(date, 1, 4) FROM CheckIns ORDER BY date')
    years_data = [row[0] for row in c.fetchall()]
    
    # If no years found, add current year
    if not years_data:
        years_data = [str(datetime.now().year)]
    
    # Also include the selected year if it's not in the list
    if str(year) not in years_data:
        years_data.append(str(year))
        years_data.sort()
    
    conn.close()
    
    # Month names for display
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    
    return jsonify({
        'current_month': {
            'name': month_names[month-1],
            'year': year,
            'total': float(current_month_revenue),
            'car_count': current_month_cars
        },
        'prev_month': {
            'name': month_names[prev_month-1],
            'year': prev_year,
            'total': float(prev_month_revenue),
            'car_count': prev_month_cars
        },
        'years_available': years_data
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
