from flask import Flask, render_template, request, redirect, url_for, send_file
import sqlite3
from datetime import datetime, timedelta
import csv

app = Flask(__name__)

# Initialize the database
def init_db():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    # Create Rooms table
    c.execute('''CREATE TABLE IF NOT EXISTS Rooms (
                    room_id INTEGER PRIMARY KEY,
                    status TEXT NOT NULL
                )''')
    # Create CheckIns table with updated schema
    c.execute('''CREATE TABLE IF NOT EXISTS CheckIns_new (
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
    
    # Check if the old CheckIns table exists
    c.execute("PRAGMA table_info(CheckIns)")
    columns = [column[1] for column in c.fetchall()]
    
    if 'checkin_time' in columns:
        # Copy data from old table to new table, adding default receipt_number and cost
        c.execute('''INSERT INTO CheckIns_new (checkin_id, room_id, staff_name, car_plate, date, time, receipt_number, cost, note, checkout_time)
                     SELECT checkin_id, room_id, staff_name, car_plate, 
                            substr(checkin_time, 1, 10), substr(checkin_time, 12), '', cost, note, checkout_time 
                     FROM CheckIns''')
        # Drop old table
        c.execute('DROP TABLE CheckIns')
    
    # Drop the existing CheckIns table if it exists
    c.execute('DROP TABLE IF EXISTS CheckIns')
    
    # Rename new table
    c.execute('ALTER TABLE CheckIns_new RENAME TO CheckIns')
    # Clear existing rooms
    c.execute('DELETE FROM Rooms')
    # Insert 40 rooms
    c.executemany('INSERT INTO Rooms (room_id, status) VALUES (?, ?)', [(i, 'Available') for i in range(1, 41)])
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def home():
    cars_today = get_cars_today()
    cars_this_week = get_cars_this_week()
    profit_today = get_profit_today()
    profit_this_week = get_profit_this_week()
    return render_template('index.html', cars_today=cars_today, cars_this_week=cars_this_week, profit_today=profit_today, profit_this_week=profit_this_week)

@app.route('/checkin', methods=['GET', 'POST'])
def checkin():
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
        return render_template('verify_form.html', **form_data)
    return render_template('checkin.html')

@app.route('/view_checkins')
def view_checkins():
    conn = sqlite3.connect('motel.db')
    c = conn.cursor()
    c.execute('SELECT * FROM CheckIns')
    checkins = c.fetchall()
    conn.close()
    return render_template('view_checkins.html', checkins=checkins)

@app.route('/export_checkins')
def export_checkins():
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
    cars_today = get_cars_today()
    cars_this_week = get_cars_this_week()
    profit_today = get_profit_today()
    profit_this_week = get_profit_this_week()
    return render_template('dashboard.html', cars_today=cars_today, cars_this_week=cars_this_week, profit_today=profit_today, profit_this_week=profit_this_week)

@app.route('/confirm_checkin', methods=['POST'])
def confirm_checkin():
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

@app.route('/login')
def login():
    return render_template('login.html')

if __name__ == '__main__':
    app.run(debug=True)
