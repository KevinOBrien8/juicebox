const { Client } = require("pg");
const { rows } = require("pg/lib/defaults");

const client = new Client("postgres://localhost:5432/juicebox-dev");

async function getAllUsers() {
  const { rows } = await client.query(
    `SELECT id, username, name, location, active
        FROM users;
        `
  );
  return rows;
}

async function createUser({ username, password, name, location }) {
  try {
    const {
      rows: [user],
    } = await client.query(
      `
        INSERT INTO users(username, password, name, location)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING
        RETURNING *;
        `,
      [username, password, name, location]
    );

    return user;
  } catch (error) {
    throw error;
  }
}

async function updateUser(id, fields = {}) {
  if (!Object.keys(fields).length) {
    return;
  }

  const setString = Object.keys(fields)
    // "username=$2, email=$3, ..."
    .map((key, index) => `"${key}" =$${index + 2}`)
    .join(", ");

  // here we're saying no fields need to be updated so we'll skip
  // the query altogether
  if (setString.length === 0) {
    return;
  }

  /* 
  
    UPDATE <TABLE-NAME>
    SET field1 = $2, field2 = $3, etc.
    WHERE id = $1 << this is hard-coded! we "reserved" the first placeholder
    RETURN *
  
    so we'll need to build the setString by offsetting the index of each
    spot in the mapped array by 2: 1 for 0-indexing, and an additional 1 for 
    the reserved placeholder for our id in the WHERE clause

    fields = { username: 'albert' , email: 'albert@mail.com' }

    const keys = Object.keys(fields) >> [ 'username', 'email' ]
    const setStringArray = keys.map((key, index = 0) => string that
      adds each key with "" to preserve any case sensitive fields in our 
      postgres DB (since case sensitive fields need double quotes to avoid
      becoming all lowercased), we'll set the key equal to a dynamically-generated
      placeholder from the offset index, which will let us start counting from 2
      so each string generated will be "keyName1"=$2, "keyName2"=$3, etc.

      once we've built the set string array, we call join and join on a comma +
      space so that our set string has the proper syntax
    )

    now our setStringArray = [ '"keyName"=$2', '"keyName"=$3', etc.]
    setStringArray.join(', ') >> `"keyName1"=$2, "keyName2=$3"`

    that set string gets passed to the SET operator
    and finally, in our values array where we protect against SQL injection,
    we'll use the ACTUAL values that were associated with those keys
    where each value will be substituted for each placeholder, ie
    the username value will be substituted for placeholder 2, etc.
  
  */

  // there will be an API route that gets the :userId from user input
  // on the route itself, like PATCH /api/users/:userId
  // the end user could easily make that /api/users/;DROP TABLE *;
  // which would CLOSE OFF a valid query and immediately issue a drop table command
  // and wipe out the entire database :(

  try {
    const {
      rows: [user],
    } = await client.query(
      `
        UPDATE users
        SET ${setString}
        WHERE id=$1
        RETURNING *;
        `,
      // this block of values is sanitized before it hits the query builder
      // so any malicious user input is nullified
      [id, ...Object.values(fields)]
    );

    return user;
  } catch (error) {
    throw error;
  }
}

async function createPost({ authorId, title, content }) {
  try {
    const {
      rows: [post],
    } = await client.query(
      `
        INSERT INTO posts("authorId", title, content)
        VALUES ($1, $2, $3)
        
        RETURNING *;
        `,
      [authorId, title, content]
    );

    return post;
  } catch (error) {
    throw error;
  }
}

async function updatePost(id, fields = {}) {
  if (!Object.keys(fields).length) {
    return;
  }

  const setString = Object.keys(fields)
    .map((key, index) => `"${key}" =$${index + 2}`)
    .join(", ");

  if (setString.length === 0) {
    return;
  }

  try {
    const {
      rows: [post],
    } = await client.query(
      `
        UPDATE posts
        SET ${setString}
        WHERE id=$1
        RETURNING *;
        `,
      // this block of values is sanitized before it hits the query builder
      // so any malicious user input is nullified
      [id, ...Object.values(fields)]
    );

    return post;
  } catch (error) {
    throw error;
  }
}

async function getAllPosts() {
  const { rows } = await client.query(
    `SELECT id, "authorId", title, content, active
        FROM posts;
        `
  );
  return rows;
}

async function getPostsByUser(userId) {
  try {
    const { rows } = await client.query(
      `
        SELECT * FROM posts
        WHERE "authorId" = $1`,
      [userId]
    );

    return rows;
  } catch (error) {
    throw error;
  }
}

async function getUserById(userId) {
  try {
    console.log("hit get user by id");

    const {
      rows: [user],
    } = await client.query(
      `
        SELECT * FROM users
        WHERE id = $1;`,
      [userId]
    );

    console.log({ user });

    if (rows.length === 0) {
      return null;
    }

    delete user.password;

    const posts = await getPostsByUser(user.id);
    console.log({ posts });
    user.posts = posts;

    return user;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  client,
  getAllUsers,
  createUser,
  updateUser,
  createPost,
  updatePost,
  getAllPosts,
  getPostsByUser,
  getUserById,
};
