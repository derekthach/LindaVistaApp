const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Dummy data for users
const users = [
  { id: 1, username: 'employee', password: '$2b$10$somethinghashed', role: 'employee' },
  { id: 2, username: 'admin', password: '$2b$10$somethinghashed', role: 'admin' }
];

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
app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: false
}));

// Logout Route
app.get('/logout', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 