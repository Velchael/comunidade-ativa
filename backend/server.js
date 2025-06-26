const app = require('./app');
const result = require('dotenv').config();
if (result.error) {
    console.error('Error loading .env file:', result.error);
  }
const PORT = process.env.PORT || 3000;

try {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error('Error starting the server:', error.message);
  }  