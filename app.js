require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const app = express();
const cors = require('cors');
const emailRoutes = require('./routes/emailRoutes'); // Import the emailRoutes router
const bookingRoutes = require('./routes/bookingRoutes'); // Import the bookingRoutes router
const path = require('path')

app.use(cors());
app.use(express.json());

// Use the emailRoutes router for the /send-email endpoint
app.use('/email', emailRoutes);
// Use the bookingRoutes router for booking-related endpoints
app.use('/bookings', bookingRoutes);

//Base path to the angular dist folder
app.use(express.static(path.join(__dirname, 'dist/casa-rural')))
app.get('*', function(req, res){
  res.sendFile(path.join(__dirname, 'dist/casa-rural/index.html'))
})

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor en ejecución en el puerto ' + (process.env.PORT || 3000));
});

module.exports = app;
