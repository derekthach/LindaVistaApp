const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { authenticateUser } = require('./auth/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/templates', express.static(path.join(__dirname, '..', 'templates')));

// Read actual users from users.json
let users = [];
try {
  const usersData = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
  users = JSON.parse(usersData);
  // Add id property if not present
  users = users.map((user, index) => ({ ...user, id: index + 1 }));
} catch (error) {
  console.error('Error reading users.json:', error);
  // Fallback to dummy users (same hashes as login-system/users.json)
  users = [
    { id: 1, username: 'employee', password: '$2b$10$xbE1ykczh5Ug.XsGawOTbejEW9UcH2NH06UIqPYAMSX4LwNdO6Efq', role: 'employee' },
    { id: 2, username: 'admin', password: '$2b$10$kG6JRrsqznKY4Z4SZ0/n4e1WqZLhLEgPiC6GlMS1r0PeWSI9R.XYa', role: 'admin' }
  ];
}

// Passport Local Strategy
passport.use(new LocalStrategy(
  function(username, password, done) {
    const user = users.find(u => u.username === username);
    if (!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    bcrypt.compare(password, user.password, (err, res) => {
      if (res) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect password.' });
      }
    });
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Routes
app.get('/', (req, res) => {
  res.send('Welcome to the login system');
});

// Login Route
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) { return res.status(401).send('Login failed'); }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      return res.send('Login successful');
    });
  })(req, res, next);
});

// Logout Route
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Middleware to check user role
function checkRole(role) {
  return function(req, res, next) {
    if (req.user && req.user.role === role) {
      return next();
    }
    res.status(403).send('Forbidden');
  }
}

// Protected Routes
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send('Welcome to the dashboard');
});

app.get('/checkin', isAuthenticated, checkRole('employee'), (req, res) => {
  res.send('Check-in page for employees');
});

app.get('/verify_form', isAuthenticated, checkRole('employee'), (req, res) => {
  res.send('Verify form page for employees');
});

app.get('/admin', isAuthenticated, checkRole('admin'), (req, res) => {
  res.send('Admin page');
});

// Add a GET route to serve the login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'templates', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 