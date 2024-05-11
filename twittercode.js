const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;
const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const validatePassword = (password) => {
  return password.length > 6;
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender)
     VALUES
      (
       '${username}',
       '${name}',
       '${hashedPassword}',
       '${gender}'  
      );`;
    if (validatePassword(password)) {
      await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const all_tweets_of_following_users = [];

const convertTweetDbObjectToResponseObject = (eachTweet) => {
  return {};
};
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);
  const UserId = userDetails.user_id;
  const selectFollowingQuery = `SELECT T.username, tweet.tweet,tweet.date_time as dateTime   
  FROM (follower inner join user on follower.following_user_id = user.user_id)
   as T 
  inner join tweet on tweet.user_id  = T.user_id 
     WHERE follower.follower_user_id = '${UserId}' 
     ORDER BY date_time DESC
     limit 4;`;
  const following_data = await database.all(selectFollowingQuery);
  ///following_data.map((each_user) => getUserTweets(each_user));
  console.log(following_data);
  ///response.send(following_data.map((eachTweet) => convertTweetDbObjectToResponseObject())
  response.send(following_data);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);
  const UserId = userDetails.user_id;
  const selectFollowingQuery = `SELECT distinct user.name  
  FROM follower inner join user on follower.following_user_id = user.user_id
     WHERE follower.follower_user_id = '${UserId}' ;`;
  const following_data = await database.all(selectFollowingQuery);
  ///following_data.map((each_user) => getUserTweets(each_user));
  console.log(following_data);
  ///response.send(following_data.map((eachTweet) => convertTweetDbObjectToResponseObject())
  response.send(following_data);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);
  const UserId = userDetails.user_id;
  const selectFollowingQuery = `SELECT distinct  name  
  FROM follower inner join user on follower.follower_user_id = user.user_id
     WHERE follower.following_user_id = '${UserId}' ;`;
  const following_data = await database.all(selectFollowingQuery);
  ///following_data.map((each_user) => getUserTweets(each_user));
  console.log(following_data);
  ///response.send(following_data.map((eachTweet) => convertTweetDbObjectToResponseObject())
  response.send(following_data);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);
  const userId = userDetails.user_id;
  const selectFollowingQuery = `
    SELECT t.tweet,
           COUNT(DISTINCT l.like_id) AS likes,
           COUNT(DISTINCT r.reply_id) AS replies,
           t.date_time AS dateTime
    FROM tweet t
    INNER JOIN follower f ON t.user_id = f.following_user_id
    LEFT JOIN reply r ON t.tweet_id = r.tweet_id
    LEFT JOIN like l ON t.tweet_id = l.tweet_id
    WHERE f.follower_user_id = '${userId}'
      AND t.tweet_id = '${tweetId}'
    GROUP BY t.tweet_id;`;
  const followingData = await database.get(selectFollowingQuery);
  if (followingData === undefined) {
    response.status(401).send("Invalid Request");
    console.log(followingData);
  } else {
    response.status(200).send(followingData);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    try {
      const { username } = request;
      const { tweetId } = request.params;

      // Get the user ID from the username
      const selectUserQuery = `SELECT user_id FROM user WHERE username = ?`;
      const userDetails = await database.get(selectUserQuery, [username]);

      if (!userDetails) {
        return response.status(400).send("Invalid Request: User not found");
      }

      const userId = userDetails.user_id;

      // Check if the user follows the author of the tweet
      const followCheckQuery = `
      SELECT 1
      FROM tweet t
      INNER JOIN follower f ON t.user_id = f.following_user_id
      WHERE f.follower_user_id = ?
        AND t.tweet_id = ?
    `;
      const followCheck = await database.get(followCheckQuery, [
        userId,
        tweetId,
      ]);

      if (!followCheck) {
        return response
          .status(400)
          .send(
            "Invalid Request: User does not follow the author of this tweet"
          );
      }

      // Proceed with fetching likes for the tweet
      const selectLikesQuery = `
      SELECT DISTINCT u.name
      FROM tweet t
      LEFT JOIN like l ON t.tweet_id = l.tweet_id
      LEFT JOIN user u ON l.user_id = u.user_id
      WHERE t.tweet_id = ?
    `;
      const likesData = await database.all(selectLikesQuery, [tweetId]);

      if (!likesData) {
        return response.status(400).send("No likes found for this tweet");
      }

      const likes = likesData.map((item) => item.name);
      const likesObj = { likes };
      response.status(200).send(likesObj);
    } catch (error) {
      console.error("Error fetching likes:", error);
      response.status(500).send("Internal Server Error");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const userDetails = await database.get(selectUserQuery);
    const userId = userDetails.user_id;
    const selectFollowingQuery = `
    SELECT distinct name, r.reply
    FROM tweet t
    INNER JOIN follower f ON t.user_id = f.following_user_id
    LEFT JOIN reply r ON t.tweet_id = r.tweet_id
    left join user u on r.user_id = u.user_id
    WHERE f.follower_user_id = '${userId}'
      AND t.tweet_id = '${tweetId}';`;
    const followingData = await database.all(selectFollowingQuery);
    if (!followingData) {
      response.status(400).send("Invalid Request");
      console.log(followingData);
    } else {
      const replies = followingData.map((item) => {
        return { name: item.name, reply: item.reply };
      });
      const replyObj = { replies };
      response.status(200).send(replyObj);
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);
  const userId = userDetails.user_id;
  const selectFollowingQuery = `
    SELECT t.tweet,
           COUNT(DISTINCT l.like_id) AS likes,
           COUNT(DISTINCT r.reply_id) AS replies,
           t.date_time AS dateTime
    FROM tweet t
    INNER JOIN follower f ON t.user_id = f.follower_user_id
    left JOIN reply r ON t.tweet_id = r.tweet_id
    LEFT JOIN like l ON t.tweet_id = l.tweet_id
    WHERE f.follower_user_id = '${userId}'
    GROUP BY t.tweet_id;`;
  const followingData = await database.all(selectFollowingQuery);
  if (followingData === undefined) {
    response.status(400).send("Invalid Request");
    console.log(followingData);
  } else {
    const tweets = followingData.map((item) => {
      return {
        tweet: item.tweet,
        likes: item.likes,
        replies: item.replies,
        dateTime: item.dateTime,
      };
    });
    const tweetsObj = { tweets };
    response.status(200).send(followingData);
  }
});

// Import necessary modules and setup Express app

// Other code and middleware...

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  try {
    const { tweet } = request.body;
    const userId = getUserIdByUsername(request.username); // Assuming you have a function to get user ID by username

    // Insert the tweet into the database
    const insertTweetQuery = `INSERT INTO tweet (user_id, tweet) VALUES (?, ?)`;
    await database.run(insertTweetQuery, [userId, tweet]);

    response.send("Created a Tweet");
  } catch (error) {
    console.error("Error creating tweet:", error);
    response.status(500).send("Internal Server Error");
  }
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    try {
      const selectUserQuery = `SELECT user_id FROM user WHERE username = ?`;
      const userDetails = await database.get(selectUserQuery, [username]);

      if (!userDetails) {
        return response.status(400).send("User not found");
      }

      const userId = userDetails.user_id;

      // Check if the tweet belongs to the user before deleting
      const selectTweetQuery = `SELECT * FROM tweet WHERE tweet_id = ? AND user_id = ?`;
      const tweetDetails = await database.get(selectTweetQuery, [
        tweetId,
        userId,
      ]);

      if (!tweetDetails) {
        return response.status(401).send("Invalid Request");
      }

      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ?`;
      await database.run(deleteTweetQuery, [tweetId]);

      response.send("Tweet Removed");
    } catch (error) {
      console.error("Error deleting tweet:", error);
      response.status(500).send("Internal Server Error");
    }
  }
);

module.exports = app;
