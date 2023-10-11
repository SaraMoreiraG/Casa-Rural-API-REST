const express = require("express");
const router = express.Router();
const cors = require("cors");
const AWS = require("aws-sdk");
const stripe = require("stripe")(process.env.STRIPE_API_TEST);

router.use(cors());
router.use(express.json());

// Initialize AWS SDK with your configured credentials
AWS.config.update({
  region: "us-east-1", // Replace with your DynamoDB region
});

// Create a DynamoDB service object
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Create a new booking (HTTP POST)
router.post("/create-booking", async (req, res) => {
  const { name, email, phone, guests, dateIn, dateOut, price } = req.body;

  if (!name || !email || !phone || !guests || !dateIn || !dateOut || !price) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const params = {
    TableName: "casarural-bookings", // Replace with your DynamoDB table name
    Item: {
      id: new Date().getTime().toString(), // Generate a unique ID (you can use a UUID or another method)
      name,
      email,
      phone,
      guests,
      dateIn,
      dateOut,
      price,
    },
  };

  dynamoDB.put(params, (err, data) => {
    if (err) {
      console.error("Error creating booking:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while creating the booking" });
    }

    res.status(201).json({
      bookingId: params.Item.id,
      message: "Booking created successfully",
    });
  });
});

// Get all booked dates
router.get("/get-all-booked-dates", (req, res) => {
  const params = {
    TableName: "casarural-bookings", // Replace with your DynamoDB table name
    ProjectionExpression: "dateIn, dateOut",
  };

  dynamoDB.scan(params, (err, data) => {
    if (err) {
      console.error("Error fetching booked dates:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching booked dates" });
    }

    const bookedDates = data.Items.map((item) => ({
      startDate: item.dateIn,
      endDate: item.dateOut,
    }));

    res.json(bookedDates);
  });
});

// Get all bookings (HTTP GET)
router.get("/get-bookings", (req, res) => {
  const params = {
    TableName: "casarural-bookings", // Replace with your DynamoDB table name
  };

  dynamoDB.scan(params, (err, data) => {
    if (err) {
      console.error("Error fetching bookings:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching bookings" });
    }

    res.status(200).json(data.Items);
  });
});

// Delete a booking by ID (HTTP DELETE)
router.delete("/delete-booking/:id", (req, res) => {
  const bookingId = req.params.id;

  const params = {
    TableName: "casarural-bookings", // Replace with your DynamoDB table name
    Key: {
      id: bookingId,
    },
  };

  dynamoDB.delete(params, (err, data) => {
    if (err) {
      console.error("Error deleting booking:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while deleting the booking" });
    }

    if (!data.Attributes) {
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

  const params = {
    TableName: "casarural-bookings", // Replace with your DynamoDB table name
    Key: {
      id: bookingId,
    },
    UpdateExpression: "SET #name = :name, #email = :email, #phone = :phone, #guests = :guests, #dateIn = :dateIn, #dateOut = :dateOut, #price = :price",
    ExpressionAttributeNames: {
      "#name": "name",
      "#email": "email",
      "#phone": "phone",
      "#guests": "guests",
      "#dateIn": "dateIn",
      "#dateOut": "dateOut",
      "#price": "price",
    },
    ExpressionAttributeValues: {
      ":name": updateFields.name,
      ":email": updateFields.email,
      ":phone": updateFields.phone,
      ":guests": updateFields.guests,
      ":dateIn": updateFields.dateIn,
      ":dateOut": updateFields.dateOut,
      ":price": updateFields.price,
    },
    ReturnValues: "ALL_NEW",
  };

  dynamoDB.update(params, (err, data) => {
    if (err) {
      console.error("Error updating booking:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while updating the booking" });
    }

    if (!data.Attributes) {
      return res
        .status(404)
        .json({ error: "Booking not found or no changes made" });
    }

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
    const formattedDateIn = parseDate(info.dateIn);
    const formattedDateOut = parseDate(info.dateOut);
    const description = `Booking: ${info.name}, Email: ${info.email}, Phone: ${info.phone}, Guests: ${info.guests}, Price: €${info.price}, Check-in: ${info.dateIn}, Check-out: ${info.dateOut}`;

    const charge = await stripe.charges.create({
      source: token.id,
      amount: info.price * 100,
      currency: "eur",
      description: description,
    });

    const bookingParams = {
      TableName: "casarural-bookings", // Replace with your DynamoDB table name
      Item: {
        id: new Date().getTime().toString(),
        name: info.name,
        email: info.email,
        phone: info.phone,
        guests: info.guests,
        dateIn: formattedDateIn,
        dateOut: formattedDateOut,
        price: info.price,
      },
    };

    dynamoDB.put(bookingParams, (err, data) => {
      if (err) {
        console.error("Error creating booking:", err);
        return res
          .status(500)
          .json({ error: "An error occurred while creating the booking" });
      }

      res.status(201).json({
        bookingId: bookingParams.Item.id,
        message: "Booking created successfully",
      });
    });
  } catch (error) {
    return res.status(500).json({ error: "Payment error" });
  }
});

function parseDate(dateString) {
  const dateParts = dateString.split("-");
  if (dateParts.length !== 3) {
    throw new Error("Invalid date format");
  }

  const day = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1;
  const year = parseInt(dateParts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error("Invalid date format");
  }

  const parsedDate = new Date(year, month, day);

  if (isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date format");
  }

  const formattedDate = parsedDate.toISOString().slice(0, 10);
  return formattedDate;
}

module.exports = router;
