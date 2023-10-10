const express = require("express");
const router = express.Router();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_API_TEST);
const mysql = require("mysql2"); // Require the MySQL module

router.use(cors());
router.use(express.json());

// Create a MySQL connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Create a new booking (HTTP POST)
router.post("/create-booking", async (req, res) => {
  const { name, email, phone, guests, dateIn, dateOut, price } = req.body;

  if (!name || !email || !phone || !guests || !dateIn || !dateOut || !price) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Create a MySQL INSERT query to add the booking to the database
  const insertQuery = `
	  INSERT INTO bookings (name, email, phone, guests, date_in, date_out, price)
	  VALUES (?, ?, ?, ?, ?, ?, ?)
	`;

  // Values to be inserted into the query
  const values = [name, email, phone, guests, dateIn, dateOut, price];

  // Execute the query
  connection.query(insertQuery, values, (err, result) => {
    if (err) {
      console.error("Error creating booking:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while creating the booking" });
    }

    // Return the newly created booking ID or any other response as needed
    res.status(201).json({
      bookingId: result.insertId,
      message: "Booking created successfully",
    });
  });
});

// Get all booked dates
router.get("/get-all-booked-dates", (req, res) => {
  const query = `
	  SELECT date_in, date_out
	  FROM bookings
	`;

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching booked dates:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching booked dates" });
    }
    const bookedDates = results.map((row) => {
      return { startDate: row.date_in, endDate: row.date_out };
    });

    res.json(bookedDates);
  });
});

// Get all bookings (HTTP GET)
router.get("/get-bookings", (req, res) => {
  const query = "SELECT * FROM bookings";

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching bookings:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching bookings" });
    }

    res.status(200).json(results);
  });
});

// Delete a booking by ID (HTTP DELETE)
router.delete("/delete-booking/:id", (req, res) => {
  const bookingId = req.params.id;

  const query = "DELETE FROM bookings WHERE id = ?";

  connection.query(query, [bookingId], (err, result) => {
    if (err) {
      console.error("Error deleting booking:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while deleting the booking" });
    }

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Booking with the specified ID not found" });
    }

    res.status(200).json({ message: "Booking deleted successfully" });
  });
});

// Update a booking by ID (HTTP PUT or PATCH)
router.put("/update-booking/:id", (req, res) => {
  const bookingId = req.params.id;
  const updateFields = req.body;

  // Ensure that at least one field to update is provided
  if (Object.keys(updateFields).length === 0) {
    return res
      .status(400)
      .json({ error: "At least one field to update is required" });
  }

  // SQL query to update the booking based on ID
  const query = `
	  UPDATE bookings
	  SET ?
	  WHERE id = ?
	`;

  // Execute the query with the provided fields and booking ID
  connection.query(query, [updateFields, bookingId], (err, result) => {
    if (err) {
      console.error("Error updating booking:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while updating the booking" });
    }

    // Check if any rows were affected (if the booking was found and updated)
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Booking not found or no changes made" });
    }

    // Return a success response
    res.status(200).json({ message: "Booking updated successfully" });
  });
});

// Define a route to handle Stripe token creation
router.post("/create-payment", async (req, res) => {
  const { info, token } = req.body;

  if (
    !info.name ||
    !info.email ||
    !info.phone ||
    !info.guests ||
    !info.dateIn ||
    !info.dateOut ||
    !info.price ||
    !token
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Create a string description from the info object
    const formattedDateIn = parseDate(info.dateIn);
    const formattedDateOut = parseDate(info.dateOut);
    const description = `Booking: ${info.name}, Email: ${info.email}, Phone: ${info.phone}, Guests: ${info.guests}, Price: €${info.price}, Check-in: ${info.dateIn}, Check-out: ${info.dateOut}`;

    // Create a charge using the Stripe token
    const charge = await stripe.charges.create({
      source: token.id,
      amount: info.price * 100, // Adjust the amount as needed
      currency: "eur", // Adjust the currency as needed
      description: description,
    });

    // Create a MySQL INSERT query to add the booking to the database
    const insertQuery = `
      INSERT INTO bookings (name, email, phone, guests, date_in, date_out, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Values to be inserted into the query
    const values = [
      info.name,
      info.email,
      info.phone,
      info.guests,
      formattedDateIn,
      formattedDateOut,
      info.price,
    ];

    // Execute the query
    connection.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error("Error creating booking:", err);
        return res
          .status(500)
          .json({ error: "An error occurred while creating the booking" });
      }

      // Return the newly created booking ID or any other response as needed
      res.status(201).json({
        bookingId: result.insertId,
        message: "Booking created successfully",
      });
    });
  } catch (error) {
    return res.status(500).json({ error: "Payment error" });
  }
});

function parseDate(dateString) {
  const dateParts = dateString.split("-"); // Split by "-"

  // Check if the date string has the correct number of parts
  if (dateParts.length !== 3) {
    throw new Error("Invalid date format");
  }

  const day = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1; // Month is 0-based (January is 0)
  const year = parseInt(dateParts[2]);

  // Check if the parsed values are valid
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error("Invalid date format");
  }

  const parsedDate = new Date(year, month, day);

  // Check if the parsed date is valid
  if (isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date format");
  }

  const formattedDate = parsedDate.toISOString().slice(0, 10);
  return formattedDate;
}

module.exports = router;
