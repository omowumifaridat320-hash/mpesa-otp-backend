const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const otpStore = {};

const ONFON_API_KEY = process.env.ONFON_API_KEY || 'PENDING_BUYER_KEY'; 
const ONFON_CLIENT_ID = 'eastafricafutures';
const ONFON_SENDER_ID = 'FUTURES LTD';
const ONFON_ACCESS_KEY = ONFON_CLIENT_ID;

// 1. Send OTP Endpoint
app.post('/api/send-otp', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[phoneNumber] = {
    otp: generatedOtp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  console.log(`\n====================================`);
  console.log(`[DEBUG] OTP FOR ${phoneNumber}: ${generatedOtp}`);
  console.log(`====================================\n`);

  try {
    const payload = {
      SenderId: ONFON_SENDER_ID,
      MessageParameters: [
        {
          Number: phoneNumber,
          Text: `Your verification code is: ${generatedOtp}`
        }
      ],
      ApiKey: ONFON_API_KEY,
      ClientId: ONFON_CLIENT_ID
    };

    const response = await axios.post(
      'https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS',
      payload,
      {
        headers: {
          'Accesskey': ONFON_ACCESS_KEY,
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

  const record = otpStore[phoneNumber];

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP requested for this number.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[phoneNumber];
    return res.status(400).json({ success: false, message: 'OTP has expired.' });
  }

  if (record.otp === otp.trim()) {
    delete otpStore[phoneNumber];
    return res.json({ success: true, verified: true, message: 'Phone number verified successfully!' });
  } else {
    return res.status(400).json({ success: false, verified: false, message: 'Invalid OTP code.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));