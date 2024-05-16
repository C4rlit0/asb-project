/**
 * Module dependencies.
 */
const path = require('path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const flash = require('express-flash');
const passport = require('passport');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const i18n = require('i18n');
const axios = require('axios');
// const RedisStore = require('connect-redis');
// const createClient = require('redis').createClient;

// /**
//  * Connect to Redis Store
//  */

// const redisClient = createClient({
//   host: process.env.REDIS_HOST,
//   port: process.env.REDIS_PORT,
//   password: process.env.REDIS_PASSWORD,
// });
// redisClient.connect().catch((error) => {
//   console.error('Error connecting to Redis:', error);
// });


/**
 * Configure Airtable
 */
const Airtable = require('airtable');
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY,
  endpointUrl: 'https://api.airtable.com'
})

/**
 * Configure i18n.
 */
i18n.configure({
  locales: ['en', 'fr'],
  directory: `${__dirname}/locales`,
  defaultLocale: 'en',
  queryParameter: 'lang',
  cookie: 'locale'
});

const upload = multer({ dest: path.join(__dirname, 'uploads') });

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: '.env' });

/**
 * Set config values
 */
const secureTransfer = (process.env.BASE_URL.startsWith('https'));

// Consider adding a proxy such as cloudflare for production.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// This logic for numberOfProxies works for local testing, ngrok use, single host deployments
// behind cloudflare, etc. You may need to change it for more complex network settings.
// See readme.md for more info.
let numberOfProxies;
if (secureTransfer) numberOfProxies = 1; else numberOfProxies = 0;

/**
 * Controllers (route handlers).
 */
const homeController = require('./controllers/home');
const onboardingController = require('./controllers/onboarding');
const dashboardController = require('./controllers/dashboard');
const userController = require('./controllers/user');
const settingsController = require('./controllers/settings');
const apiController = require('./controllers/api');
const contactController = require('./controllers/contact');

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();
console.log('Run this app using "npm start" to include sass/scss/css builds.\n');

/**
 * Connect to Airtable
 */
// Try connecting to the base doing a base schema request with axios | GET https://api.airtable.com/v0/meta/bases/BaseId/tables
// The metadata API uses token-based authentication like Airtable's standard REST API. Users will need to paste their Airtable account's API key (available from your account page) into your integration. Send the API key in the Authorization header of all your requests:

// Authorization: Bearer $USER_API_KEY
// After you receive a client secret from us, you must send a X-Airtable-Client-Secret HTTP header with all your requests to help us identify and authenticate your integration. If you fail to do this, your request will be blocked.

// Enterprise Airtable accounts do not require a separate Metadata API client secret. A separate Metadata API client secret is also not required if using personal access tokens or OAuth integrations.

// X-Airtable-Client-Secret: foo-123123
// Finally, please perform all requests to these endpoints server-side.
const AIRTABLE_BASE_SCHEMA = axios.get(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
  headers: {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
  }
})
.then((response) => {
  const schema = response.data;

  // Verify SESSIONS table exists in schema
  const sessionsTable = schema.tables.find(table => table.name === 'SESSIONS');
  if (sessionsTable) {
    console.log('Table "SESSIONS" exists in Airtable schema');
    const requiredFields = ['SID', 'USER', 'ID', 'SESSION', 'EXPIRE'];
    const allFieldsExist = requiredFields.every(field => sessionsTable.fields.map(f => f.name).includes(field));
    if (allFieldsExist) {
      console.log('All fields exist in Airtable schema');
    } else {
      console.error('Some fields do not exist in Airtable schema');
    }
  } else {
    console.error('Table "SESSIONS" does not exist in Airtable schema');
  }

  // Verify USERS table exists in schema
  const usersTable = schema.tables.find(table => table.name === 'USERS');
  if (usersTable) {
    console.log('Table "USERS" exists in Airtable schema');
    const requiredFields = [
      'ID',
      'EMAIL',
      'PASSWORD',
      'PWD_RESET_TKN',
      'PWD_RESET_EXPIRES',
      'EMAIL_VERIFICATION_TKN',
      'EMAIL_VERIFIED',
      'NAME',
      'ONBOARDING_DONE',
      'GITHUB_ENABLED',
      'GITHUB_ORG',
      'GITHUB_OWNER',
      'GITHUB_PAT',
      'GITHUB_REPO',
      'GITHUB_REPO_STATUS',
      'GITHUB_REPO_DESCRIPTION',
      'GITHUB_REPO_CREATION_DATE',
      'CREATED_AT',
      'UPDATED_AT',
      'SESSIONS'
    ];
    const allFieldsExist = requiredFields.every(field => usersTable.fields.map(f => f.name).includes(field));
    if (allFieldsExist) {
      console.log('All fields exist in Airtable schema');
    } else {
      console.error('Some fields do not exist in Airtable schema');
    }
  } else {
    console.error('Table "USERS" does not exist in Airtable schema');
  }
})
.catch((error) => {
  console.error('Error fetching Airtable base schema:', error);
});

/**
 * Express configuration.
 */
app.set('host', process.env.BASE_URL || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0');
app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8081);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', numberOfProxies);
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(limiter);
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  name: 'startercookie', // change the cookie name for additional security in production
  cookie: {
    maxAge: 1209600000, // Two weeks in milliseconds
    secure: secureTransfer
  },

  // Store the session in Airtable instead of memory
  // WIP connect-artiable
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  if (req.path === '/api/upload') {
    // Multer multipart/form-data handling needs to occur before the Lusca CSRF check.
    next();
  } else {
    lusca.csrf()(req, res, next);
  }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.disable('x-powered-by');
app.use((req, res, next) => {
  const lang = req.query.lang || 'fr';
  // console.log("lang:", lang);
  i18n.setLocale(lang);
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user
    && req.path !== '/login'
    && req.path !== '/signup'
    && !req.path.match(/^\/auth/)
    && !req.path.match(/\./)) {
    req.session.returnTo = req.originalUrl;
  } else if (req.user
    && (req.path === '/account' || req.path.match(/^\/api/))) {
    req.session.returnTo = req.originalUrl;
  }
  next();
});
app.use('/', express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));
app.use('/js/lib', express.static(path.join(__dirname, 'node_modules/chart.js/dist'), { maxAge: 31557600000 }));
app.use('/js/lib', express.static(path.join(__dirname, 'node_modules/popper.js/dist/esm'), { maxAge: 31557600000 }));
app.use('/js/lib', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js'), { maxAge: 31557600000 }));
app.use('/js/lib', express.static(path.join(__dirname, 'node_modules/jquery/dist'), { maxAge: 31557600000 }));
app.use('/webfonts', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free/webfonts'), { maxAge: 31557600000 }));

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/onboarding', passportConfig.isAuthenticated, onboardingController.getOnboarding);
app.post('/onboarding', passportConfig.isAuthenticated, onboardingController.postOnboarding);
app.get('/onboarding/:nextstep', passportConfig.isAuthenticated, onboardingController.getOnboardingNextStep);
app.post('/onboarding/:nextstep', passportConfig.isAuthenticated, onboardingController.postOnboardingNextStep);
app.get('/dashboard', passportConfig.isAuthenticated, dashboardController.getDashboard);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account/verify', passportConfig.isAuthenticated, userController.getVerifyEmail);
app.get('/account/verify/:token', passportConfig.isAuthenticated, userController.getVerifyEmailToken);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
app.get('/account/settings', passportConfig.isAuthenticated, settingsController.getSettings);
app.post('/account/settings', passportConfig.isAuthenticated, settingsController.postSettings);

/**
 * API examples routes.
 */
app.get('/api', apiController.getApi);
app.get('/api/profile', passportConfig.isAuthenticated, apiController.getProfile);
app.get('/api/lastfm', apiController.getLastfm);
app.get('/api/nyt', apiController.getNewYorkTimes);
app.get('/api/steam', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getSteam);
app.get('/api/stripe', apiController.getStripe);
app.post('/api/stripe', apiController.postStripe);
app.get('/api/scraping', apiController.getScraping);
app.get('/api/foursquare', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFoursquare);
app.get('/api/tumblr', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTumblr);
app.get('/api/facebook', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFacebook);
app.get('/api/github', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGithub);
app.get('/api/twitch', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTwitch);
app.get('/api/paypal', apiController.getPayPal);
app.get('/api/paypal/success', apiController.getPayPalSuccess);
app.get('/api/paypal/cancel', apiController.getPayPalCancel);
app.get('/api/lob', apiController.getLob);
app.get('/api/upload', lusca({ csrf: true }), apiController.getFileUpload);
app.post('/api/upload', upload.single('myFile'), lusca({ csrf: true }), apiController.postFileUpload);
app.get('/api/pinterest', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getPinterest);
app.post('/api/pinterest', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.postPinterest);
app.get('/api/here-maps', apiController.getHereMaps);
app.get('/api/google-maps', apiController.getGoogleMaps);
app.get('/api/google/drive', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGoogleDrive);
app.get('/api/chart', apiController.getChart);
app.get('/api/google/sheets', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGoogleSheets);
app.get('/api/quickbooks', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getQuickbooks);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/snapchat', passport.authenticate('snapchat'));
app.get('/auth/snapchat/callback', passport.authenticate('snapchat', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets.readonly'], accessType: 'offline', prompt: 'consent' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitch', passport.authenticate('twitch', {}));
app.get('/auth/twitch/callback', passport.authenticate('twitch', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});

app.get('/auth/airtable', passport.authenticate('airtable', { scope: process.env.AIRTABLE_SCOPES }));
app.get('/auth/airtable/callback', passport.authenticate('airtable', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes. (API examples)
 */
app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), (req, res) => {
  res.redirect('/api/foursquare');
});
app.get('/auth/tumblr', passport.authorize('tumblr'));
app.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), (req, res) => {
  res.redirect('/api/tumblr');
});
app.get('/auth/steam', passport.authorize('steam-openid', { state: 'SOME STATE' }));
app.get('/auth/steam/callback', passport.authorize('steam-openid', { failureRedirect: '/api' }), (req, res) => {
  res.redirect(req.session.returnTo);
});
app.get('/auth/pinterest', passport.authorize('pinterest', { scope: 'read_public write_public' }));
app.get('/auth/pinterest/callback', passport.authorize('pinterest', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/api/pinterest');
});
app.get('/auth/quickbooks', passport.authorize('quickbooks', { scope: ['com.intuit.quickbooks.accounting'], state: 'SOME STATE' }));
app.get('/auth/quickbooks/callback', passport.authorize('quickbooks', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo);
});

/**
 * Error Handler.
 */
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  res.status(404).send('Page Not Found');
});

if (process.env.NODE_ENV === 'development') {
  // only use in development
  app.use(errorHandler());
} else {
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Server Error');
  });
}

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  const { BASE_URL } = process.env;
  const colonIndex = BASE_URL.lastIndexOf(':');
  const port = parseInt(BASE_URL.slice(colonIndex + 1), 10);

  if (!BASE_URL.startsWith('http://localhost')) {
    console.log(`The BASE_URL env variable is set to ${BASE_URL}. If you directly test the application through http://localhost:${app.get('port')} instead of the BASE_URL, it may cause a CSRF mismatch or an Oauth authentication failur. To avoid the issues, change the BASE_URL or configure your proxy to match it.\n`);
  } else if (parseInt(app.get('port'), 10) !== port) {
    console.warn(`WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: ${BASE_URL}\n`);
  }

  console.log(`App is running on ${BASE_URL} in ${app.get('env')} mode.`);
  console.log('Press CTRL-C to stop.');
});

module.exports = app;
