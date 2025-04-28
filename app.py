from flask import Flask, render_template, request, redirect, url_for, send_file, session
import sqlite3
from datetime import datetime, timedelta
import csv
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Secret key for sessions

# Initialize the database
def init_db():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    
    # Create Rooms table if it doesn't exist
    c.execute('''CREATE TABLE IF NOT EXISTS Rooms (
                    room_id INTEGER PRIMARY KEY,
                    status TEXT NOT NULL
                )''')
                
    # Create CheckIns table with updated schema
    c.execute('''CREATE TABLE IF NOT EXISTS CheckIns (
                    checkin_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_number TEXT,                    
                    date TEXT,
                    time TEXT,
                    room_id INTEGER,
                    cost REAL,
                    payment_method TEXT,
                    staff_name TEXT,
                    car_plate TEXT,
                    car_make TEXT,
                    car_color TEXT,
                    note TEXT,
                    FOREIGN KEY(room_id) REFERENCES Rooms(room_id)
                )''')
    
    # Check if we need to insert initial rooms (only if Rooms is empty)
    c.execute('SELECT COUNT(*) FROM Rooms')
    room_count = c.fetchone()[0]
    
    # Only populate rooms if the table is empty
    if room_count == 0:
        c.executemany('INSERT INTO Rooms (room_id, status) VALUES (?, ?)', 
                     [(i, 'Available') for i in range(1, 41)])
        
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
    return render_template('checkin.html', 
                           logged_in=True,
                           role=session.get('role'))

@app.route('/view_checkins')
def view_checkins():
    if not session.get('logged_in', False):
        return redirect(url_for('login'))
    
    # Employees should not have access to view all check-ins
    if session.get('role') == 'employee':
        return redirect(url_for('checkin'))
        
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    c.execute('SELECT * FROM CheckIns')
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
        
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    c.execute('SELECT checkin_id, date, time, receipt_number, room_id, staff_name, car_plate, cost, note FROM CheckIns')
    rows = c.fetchall()
    conn.close()

    # Write to CSV
    with open('checkins_export.csv', 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['Check-In ID', 'Date', 'Time', 'Receipt Number', 'Room ID', 'Staff Name', 'Car Plate', 'Cost', 'Notes'])
        csvwriter.writerows(rows)

    return send_file('checkins_export.csv', as_attachment=True)

def get_cars_today():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    c.execute('SELECT COUNT(*) FROM CheckIns WHERE date = ?', (today,))
    cars_today = c.fetchone()[0]
    conn.close()
    return cars_today


def get_cars_this_week():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = datetime.now()
    start_of_week = today - timedelta(days=today.weekday())
    c.execute('SELECT COUNT(*) FROM CheckIns WHERE date BETWEEN ? AND ?', (start_of_week.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
    cars_this_week = c.fetchone()[0]
    conn.close()
    return cars_this_week


def get_profit_today():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    c.execute('SELECT SUM(cost) FROM CheckIns WHERE date = ?', (today,))
    profit_today = c.fetchone()[0] or 0
    conn.close()
    return profit_today


def get_profit_this_week():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    today = datetime.now()
    start_of_week = today - timedelta(days=today.weekday())
    c.execute('SELECT SUM(cost) FROM CheckIns WHERE date BETWEEN ? AND ?', (start_of_week.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
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
    
    # Both employees and admins can confirm check-ins
    
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
    
    # Insert data into the database
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO CheckIns (room_id, receipt_number, date, time, cost, payment_method, car_plate, car_make, car_color, staff_name, note)
        VALUES (:room_id, :receipt_number, :date, :time, :cost, :payment_method, :car_plate, :car_make, :car_color, :staff_name, :note)
    ''', form_data)
    conn.commit()
    conn.close()
    
    # Redirect to the checkin page
    return redirect(url_for('checkin'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Authentication logic for different user roles
        if username == 'admin' and password == 'password':
            session['logged_in'] = True
            session['username'] = username
            session['role'] = 'admin'  # Admin role with full access
            return redirect(url_for('dashboard'))
        elif username == 'employee' and password == 'employee123':
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

if __name__ == '__main__':
    app.run(debug=True, port=5001)
