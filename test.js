const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://prasantag179_db_user:IIYqWGH4y0uOgl2W@cluster0.yfaw1do.mongodb.net/test"
)
.then(() => {
    console.log("Connected");
    process.exit();
})
.catch(err => {
    console.log(err);
});