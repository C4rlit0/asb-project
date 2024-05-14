const passport = require('passport');
const refresh = require('passport-oauth2-refresh');
const axios = require('axios');

// include Airtable config file

const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GitHubStrategy } = require('passport-github2');
const { OAuth2Strategy: GoogleStrategy } = require('passport-google-oauth');
const { Strategy: OAuth2Strategy } = require('passport-oauth2');
const _ = require('lodash');
const moment = require('moment');
const airtable = require('./airtable');

const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    return done(null, await User.findByPk(id));
  } catch (error) {
    return done(error);
  }
});

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return done(null, false, { msg: `Email ${email} not found.` });
    }
    if (!user.password) {
      return done(null, false, { msg: 'Your account was registered using a sign-in provider. To enable password login, sign in using a provider, and then set a password under your user profile.' });
    }
    const isMatch = await user.comparePassword(password);
    if (isMatch) {
      return done(null, user);
    }
    return done(null, false, { msg: 'Invalid email or password.' });
  } catch (err) {
    return done(err);
  }
}));

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with GitHub.
 */
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_ID,
  clientSecret: process.env.GITHUB_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/github/callback`,
  passReqToCallback: true,
  scope: ['user:email']
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await User.findOne({ github: profile.id });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a GitHub account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await User.findById(req.user.id);
      user.github = profile.id;
      user.tokens.push({ kind: 'github', accessToken });
      user.profile.name = user.profile.name || profile.displayName;
      user.profile.picture = user.profile.picture || profile._json.avatar_url;
      user.profile.location = user.profile.location || profile._json.location;
      user.profile.website = user.profile.website || profile._json.blog;
      await user.save();
      req.flash('info', { msg: 'GitHub account has been linked.' });
      return done(null, user);
    }
    const existingUser = await User.findOne({ github: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const emailValue = _.get(_.orderBy(profile.emails, ['primary', 'verified'], ['desc', 'desc']), [0, 'value'], null);
    if (profile._json.email === null) {
      const existingEmailUser = await User.findOne({ email: emailValue });

      if (existingEmailUser) {
        req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with GitHub manually from Account Settings.' });
        return done(null, existingEmailUser);
      }
    } else {
      const existingEmailUser = await User.findOne({ email: profile._json.email });
      if (existingEmailUser) {
        req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with GitHub manually from Account Settings.' });
        return done(null, existingEmailUser);
      }
    }
    const user = new User();
    user.email = emailValue;
    user.github = profile.id;
    user.tokens.push({ kind: 'github', accessToken });
    user.profile.name = profile.displayName;
    user.profile.picture = profile._json.avatar_url;
    user.profile.location = profile._json.location;
    user.profile.website = profile._json.blog;
    await user.save();
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/**
 * Sign in with Google.
 */
const googleStrategyConfig = new GoogleStrategy({
  clientID: process.env.GOOGLE_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  callbackURL: '/auth/google/callback',
  passReqToCallback: true
}, async (req, accessToken, refreshToken, params, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await User.findOne({ google: profile.id });
      if (existingUser && (existingUser.id !== req.user.id)) {
        req.flash('errors', { msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await User.findById(req.user.id);
      user.google = profile.id;
      user.tokens.push({
        kind: 'google',
        accessToken,
        accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
        refreshToken,
      });
      user.profile.name = user.profile.name || profile.displayName;
      user.profile.gender = user.profile.gender || profile._json.gender;
      user.profile.picture = user.profile.picture || profile._json.picture;
      await user.save();
      req.flash('info', { msg: 'Google account has been linked.' });
      return done(null, user);
    }
    const existingUser = await User.findOne({ google: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const existingEmailUser = await User.findOne({ email: profile.emails[0].value });
    if (existingEmailUser) {
      req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Google manually from Account Settings.' });
      return done(null, existingEmailUser);
    }
    const user = new User();
    user.email = profile.emails[0].value;
    user.google = profile.id;
    user.tokens.push({
      kind: 'google',
      accessToken,
      accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
      refreshToken,
    });
    user.profile.name = profile.displayName;
    user.profile.gender = profile._json.gender;
    user.profile.picture = profile._json.picture;
    await user.save();
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});
passport.use('google', googleStrategyConfig);
refresh.use('google', googleStrategyConfig);

/**
 * Intuit/QuickBooks API OAuth.
 */
// const quickbooksStrategyConfig = new OAuth2Strategy({
//   authorizationURL: 'https://appcenter.intuit.com/connect/oauth2',
//   tokenURL: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
//   clientID: process.env.QUICKBOOKS_CLIENT_ID,
//   clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
//   callbackURL: `${process.env.BASE_URL}/auth/quickbooks/callback`,
//   passReqToCallback: true,
// },
// async (req, accessToken, refreshToken, params, profile, done) => {
//   try {
//     const user = await User.findById(req.user._id);
//     user.quickbooks = req.query.realmId;
//     const quickbooksToken = user.tokens.find((vendor) => vendor.kind === 'quickbooks');
//     if (quickbooksToken) {
//       quickbooksToken.accessToken = accessToken;
//       quickbooksToken.accessTokenExpires = moment().add(params.expires_in, 'seconds').format();
//       quickbooksToken.refreshToken = refreshToken;
//       quickbooksToken.refreshTokenExpires = moment().add(params.x_refresh_token_expires_in, 'seconds').format();
//       if (params.expires_in) quickbooksToken.accessTokenExpires = moment().add(params.expires_in, 'seconds').format();
//     } else {
//       user.tokens.push({
//         kind: 'quickbooks',
//         accessToken,
//         accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
//         refreshToken,
//         refreshTokenExpires: moment().add(params.x_refresh_token_expires_in, 'seconds').format(),
//       });
//     }
//     user.markModified('tokens');
//     await user.save();
//     return done(null, user);
//   } catch (err) {
//     return done(err);
//   }
// });
// passport.use('quickbooks', quickbooksStrategyConfig);
// refresh.use('quickbooks', quickbooksStrategyConfig);

/**
 * Airtable API Oauth2
 */

const airtableStrategyConfig = new OAuth2Strategy({
  authorizationURL: 'https://airtable.com/oauth2/v1/authorize', // Ajustez selon la doc d'Airtable
  tokenURL: 'https://airtable.com/oauth2/v1/token', // Ajustez selon la doc d'Airtable
  clientID: process.env.AIRTABLE_CLIENT_ID,
  clientSecret: process.env.AIRTABLE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/airtable/callback`,
  scope: process.env.AIRTABLE_SCOPE, // Ajustez selon la doc d'Airtable
  passReqToCallback: true, // Pour passer la requête au callback
  state: true,
  pkce: true
}, (req, accessToken, refreshToken, params, profile, done) => {
  console.log('req query: ', req.query);
  console.log('accessToken: ', accessToken);
  console.log('refreshToken: ', refreshToken);
  console.log('params: ', params);

  // Si params n'est pas vide, on a reçu un code d'autorisation
  if (params) {
    // On fait un appel à l'API d'Airtable pour récupérer les informations de l'utilisateur
    axios.get('https://api.airtable.com/v0/meta/whoami', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
      .then((response) => {
        // Retreive the user infos from the response
        const airtableUser = response.data;
        console.log('airtableUser: ', airtableUser);

        const user = new User({
          email: airtableUser.email,
          password: null // Because we are using OAuth, we don't need a password
        });
        // On vérifie si l'utilisateur est déjà enregistré dans la base de données en le cherchant par son email avec 'where'
        User.findOne({ where: { email: user.email } })
          .then((existingUser) => {
            if (existingUser) {
              // Si l'utilisateur existe déjà, on le connecte
              console.log('User already exists');
              done(null, existingUser);
            }
            user.save()
              .then(() => {
                req.logIn(user, (err) => {
                  if (err) {
                    return done(err);
                  }
                  console.log('User saved successfully');
                  done(null, user);
                });
              })
              .catch((err) => done(err));
          })
          .catch((err) => done(err));
      })
      .catch((error) => {
        console.error('Error while fetching user infos from Airtable API: ', error);
        done(error);
      });
  }
});

// User.findById(req.user._id, (err, user) => {
//   if (err) { return done(err); }

//   // Logique pour mettre à jour ou ajouter le token d'Airtable à l'utilisateur
//   const existingToken = user.tokens.find(token => token.kind === 'airtable');

//   if (existingToken) {
//     existingToken.accessToken = accessToken;
//     existingToken.accessTokenExpires = moment().add(params.expires_in, 'seconds').toDate();
//     existingToken.refreshToken = refreshToken;
//     existingToken.refreshTokenExpires = moment().add(params.x_refresh_token_expires_in, 'seconds').toDate();
//   } else {
//     user.tokens.push({
//       kind: 'airtable',
//       accessToken,
//       accessTokenExpires: moment().add(params.expires_in, 'seconds').toDate(),
//       refreshToken,
//       refreshTokenExpires: moment().add(params.x_refresh_token_expires_in, 'seconds').toDate()
//     });
//   }

//   user.save((err) => {
//     if (err) { return done(err); }
//     return done(null, user);
//   });
// });
//   }
// );

passport.use('airtable', airtableStrategyConfig);
refresh.use('airtable', airtableStrategyConfig);

/**
 * Login Required middleware.
 */
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = async (req, res, next) => {
  const provider = req.path.split('/')[2];
  const token = req.user.tokens.find((token) => token.kind === provider);
  if (token) {
    if (token.accessTokenExpires && moment(token.accessTokenExpires).isBefore(moment().subtract(1, 'minutes'))) {
      if (token.refreshToken) {
        if (token.refreshTokenExpires && moment(token.refreshTokenExpires).isBefore(moment().subtract(1, 'minutes'))) {
          return res.redirect(`/auth/${provider}`);
        }
        try {
          const newTokens = await new Promise((resolve, reject) => {
            refresh.requestNewAccessToken(`${provider}`, token.refreshToken, (err, accessToken, refreshToken, params) => {
              if (err) reject(err);
              resolve({ accessToken, refreshToken, params });
            });
          });

          req.user.tokens.forEach((tokenObject) => {
            if (tokenObject.kind === provider) {
              tokenObject.accessToken = newTokens.accessToken;
              if (newTokens.params.expires_in) tokenObject.accessTokenExpires = moment().add(newTokens.params.expires_in, 'seconds').format();
            }
          });

          await req.user.save();
          return next();
        } catch (err) {
          console.log(err);
          return next();
        }
      } else {
        return res.redirect(`/auth/${provider}`);
      }
    } else {
      return next();
    }
  } else {
    return res.redirect(`/auth/${provider}`);
  }
};
