import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;



const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Для работы с защищенными соединениями
    }
});

db.connect()
  .then(() => console.log("Connected to database"))
  .catch(err => console.error("Database connection error:", err));


app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }))

app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/quiz/:id", async (req, res) => {
    const userId = req.params.id;  // получаем id пользователя из параметра URL
    try {
        const result = await db.query("SELECT cards.title, cards.description FROM cards JOIN users ON cards.userid = users.id WHERE users.id = $1", [userId]);
        res.render("quiz.ejs", { cards: result.rows , userId: userId});

    } catch (err) {
        console.log(err);
        res.status(500).send("Ошибка при получении данных");
    };
});

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;

    bcrypt.genSalt(saltRounds, function(err, salt) {
        bcrypt.hash(password, salt, async function(err, hash) {
            try {
                await db.query("INSERT INTO users (email, password) VALUES ($1, $2);", [email, hash]);
                try {
                    const result = await db.query("SELECT * FROM users WHERE email=$1 AND password=$2", [email, hash]);
                    res.redirect(`/quiz/${result.rows[0].id}`);
                } catch (err) {
                    console.log(err);
                    res.render("register.ejs", { err: err.message });
                }
            } catch (err) {
                console.log(err);
                res.render("register.ejs", { err: err.message }); 
            }
        });
    });
    
});

app.post("/login", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    const hash = await db.query("SELECT password FROM users WHERE email=$1", [email])
    const hashPassword = hash.rows[0]["password"]
    
    bcrypt.compare(password, hashPassword, async function(err, result) {
        if (err) {
            console.error(err);
            res.render("login.ejs", { err: err.message }); 
        } else if (result) {
            try {
                const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
                if (result.rows.length > 0) {
                    // the user was found and we have id
                    const userId = result.rows[0].id;
        
                    res.redirect(`/quiz/${userId}`);
                } else {
                    res.render("login.ejs", { err: "Неверный email или пароль." });
                }
            } catch (err) {
                    console.log(err);
                    res.render("login.ejs", { err: err.message }); 
            }
        } else {
            console.log('Пароль неверный.');
        }
    });

})

app.post("/quiz-add", async (req, res) => {

    const newCardTitle = req.body.card_title
    const newCardDescription = req.body.card_description
    const userId = req.body.userId

    if (newCardTitle.length > 0 && newCardDescription.length > 0) {
       await db.query("INSERT INTO cards (userId, title, description) VALUES ($1, $2, $3);", [userId, newCardTitle, newCardDescription])
    }
    res.redirect(`/quiz/${userId}`);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
