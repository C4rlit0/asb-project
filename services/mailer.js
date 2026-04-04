const nodemailer = require('nodemailer');

/**
 * Shared mail sending utility.
 * Handles self-signed certificate fallback automatically.
 *
 * @param {object} settings
 * @param {object} settings.mailOptions      - nodemailer mail options (to, from, subject, text)
 * @param {object} settings.req              - Express request (used for flash messages)
 * @param {string} settings.successfulType   - Flash type on success (e.g. 'success', 'info')
 * @param {string} settings.successfulMsg    - Flash message on success
 * @param {string} settings.errorType        - Flash type on error (e.g. 'errors', 'warning')
 * @param {string} settings.errorMsg         - Flash message on error
 * @param {string} settings.loggingError     - Prefix for the console error log
 */
const sendMail = (settings) => {
  const transportConfig = {
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      type: 'login',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  let transporter = nodemailer.createTransport(transportConfig);

  return transporter.sendMail(settings.mailOptions)
    .then(() => {
      settings.req.flash(settings.successfulType, { msg: settings.successfulMsg });
    })
    .catch((err) => {
      if (err.message === 'self signed certificate in certificate chain') {
        console.log('WARNING: Self signed certificate in certificate chain. Retrying with the self signed certificate. Use a valid certificate if in production.');
        transportConfig.tls = transportConfig.tls || {};
        transportConfig.tls.rejectUnauthorized = false;
        transporter = nodemailer.createTransport(transportConfig);
        return transporter.sendMail(settings.mailOptions)
          .then(() => {
            settings.req.flash(settings.successfulType, { msg: settings.successfulMsg });
          });
      }
      console.error(settings.loggingError, err);
      settings.req.flash(settings.errorType, { msg: settings.errorMsg });
      return err;
    });
};

module.exports = { sendMail };
