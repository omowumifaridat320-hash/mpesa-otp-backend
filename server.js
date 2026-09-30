const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const otpStore = {};

const ONFON_API_KEY = process.env.ONFON_API_KEY;
const ONFON_CLIENT_ID = process.env.ONFON_CLIENT_ID || 'eastafricafutures';
const ONFON_SENDER_ID = process.env.ONFON_SENDER_ID || 'FUTURES LTD';

// Helper function to standardize Kenyan phone numbers to 254XXXXXXXXX format
function formatPhoneNumber(number) {
  if (!number) return '';
  let cleaned = number.toString().replace(/\D/g, ''); // Remove non-digit characters
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('+254')) {
    cleaned = cleaned.substring(1);
  } else if (!cleaned.startsWith('254') && cleaned.length === 9) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

// 1. Send OTP Endpoint
app.post('/api/send-otp', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  const formattedNumber = formatPhoneNumber(phoneNumber);
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store using the normalized phone number key
  otpStore[formattedNumber] = {
    otp: generatedOtp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  console.log(`\n====================================`);
  console.log(`[DEBUG] OTP FOR ${formattedNumber}: ${generatedOtp}`);
  console.log(`====================================\n`);

  try {
    const payload = {
      SenderId: ONFON_SENDER_ID,
      ApiKey: ONFON_API_KEY,
      AccessKey: ONFON_API_KEY,
      ClientId: ONFON_CLIENT_ID,
      MessageParameters: [
        {
          Number: formattedNumber,
          Text: `Your verification code is: ${generatedOtp}`
        }
      ]
    };

    const response = await axios.post(
      'https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS',
      payload,
      {
        headers: {
          'Accesskey': ONFON_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[ONFON SUCCESS]:', response.data);

    return res.json({ 
      success: true, 
      message: 'OTP sent via SMS!' 
    });

  } catch (error) {
    console.error('[ONFON API NOTICE]:', error.response ? error.response.data : error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send SMS via provider. Please try again later.'
    });
  }
});

// 2. Verify OTP Endpoint
app.post('/api/verify-otp', (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ success: false, message: 'Phone number and OTP are required.' });
  }

  const formattedNumber = formatPhoneNumber(phoneNumber);
  const record = otpStore[formattedNumber];

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP requested for this number.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[formattedNumber];
    return res.status(400).json({ success: false, message: 'OTP has expired.' });
  }

  if (record.otp === otp.trim()) {
    delete otpStore[formattedNumber];
    return res.json({ success: true, verified: true, message: 'Phone number verified successfully!' });
  } else {
    return res.status(400).json({ success: false, verified: false, message: 'Invalid OTP code.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));