const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const datesfns = require("date-fns");
const { parseISO, format } = require("date-fns");
const isValid = require("date-fns/isValid");

const databasePath = path.join(__dirname, "todoApplication.db");

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

const hasPriorityAndStatusProperties = (requestQuery) => {
  return (
    requestQuery.priority !== undefined && requestQuery.status !== undefined
  );
};

const hasPriorityProperty = (requestQuery) => {
  return requestQuery.priority !== undefined;
};

const hasStatusProperty = (requestQuery) => {
  return requestQuery.status !== undefined;
};

const hasCategoryAndStatus = (requestQuery) => {
  return (
    requestQuery.status !== undefined && requestQuery.category !== undefined
  );
};
const hasCategoryProperty = (requestQuery) => {
  return requestQuery.category !== undefined;
};
const hasCategoryAndPriority = (requestQuery) => {
  return (
    requestQuery.category !== undefined && requestQuery.priority !== undefined
  );
};
const convertTodoDbObjectToResponseObject = (dbObject) => {
  return {
    id: dbObject.id,
    todo: dbObject.todo,
    priority: dbObject.priority,
    status: dbObject.status,
    category: dbObject.category,
    dueDate: dbObject.due_date,
  };
};
const validPriority = ["HIGH", "MEDIUM", "LOW", undefined];
const validStatus = ["TO DO", "IN PROGRESS", "DONE", undefined];
const validCategory = ["WORK", "HOME", "LEARNING", undefined];

const validateValuesMiddlewareQuery = (request, response, next) => {
  const { priority, status, category, dueDate } = request.query;

  if (!validStatus.includes(status)) {
    return response.status(400).json({ error: "Invalid Todo Status" });
  }
  if (!validPriority.includes(priority)) {
    return response.status(400).json({ error: "Invalid Todo Priority" });
  }
  if (!validCategory.includes(category)) {
    return response.status(400).json({ error: "Invalid Todo Category" });
  }
  if (dueDate && !isValid(parseISO(dueDate))) {
    return response.status(400).json({ error: "Invalid Due Date" });
  }

  next();
};

const validateValuesMiddlewareBody = (request, response, next) => {
  const { priority, status, category, dueDate } = request.body;

  if (!validStatus.includes(status)) {
    return response.status(400).send("Invalid Todo Status");
  }
  if (!validPriority.includes(priority)) {
    return response.status(400).send("Invalid Todo Priority");
  }
  if (!validCategory.includes(category)) {
    return response.status(400).send("Invalid Todo Category");
  }
  if (dueDate && !isValid(parseISO(dueDate))) {
    return response.status(400).send("Invalid Due Date");
  }

  next();
};

app.get("/todos/", validateValuesMiddlewareQuery, async (request, response) => {
  let data = null;
  let getTodosQuery = "";
  const { search_q = "", priority, status, category } = request.query;

  switch (true) {
    case hasPriorityAndStatusProperties(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND status = '${status}'
        AND priority = '${priority}';`;
      break;
    case hasCategoryAndStatus(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND category = '${category}' 
        AND status = '${status}';`;
      break;
    case hasCategoryAndPriority(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND category = '${category}' 
        AND priority = '${priority};`;
      break;
    case hasPriorityProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND priority = '${priority}';`;
      break;
    case hasStatusProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND status = '${status}';`;
      break;
    case hasCategoryProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND category = '${category}';`;
      break;
    default:
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%';`;
  }

  data = await database.all(getTodosQuery);

  response.send(
    data.map((eachTodo) => convertTodoDbObjectToResponseObject(eachTodo))
  );
});

app.post(
  "/todos/",
  validateValuesMiddlewareQuery,
  validateValuesMiddlewareBody,
  async (request, response) => {
    const { id, todo, priority, status, category, dueDate } = request.body;
    const postTodoQuery = `
  INSERT INTO
    todo (id, todo,category, priority, status, due_date)
  VALUES
    (${id}, '${todo}', '${category}', '${priority}' , '${status}' , '${dueDate}');`;
    await database.run(postTodoQuery);
    response.send("Todo Successfully Added");
  }
);

app.get(
  "/agenda/",
  validateValuesMiddlewareQuery,
  async (request, response) => {
    let data = null;
    const { date } = request.query;
    const parsedDate = parseISO(date);
    const formattedDate = format(parsedDate, "yyyy-MM-dd");
    const getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        due_date = '${formattedDate}';`;
    data = await database.all(getTodosQuery);
    response.send(
      data.map((eachTodo) => convertTodoDbObjectToResponseObject(eachTodo))
    );
  }
);

app.get(
  "/todos/:todoId/",
  validateValuesMiddlewareQuery,
  async (request, response) => {
    const { todoId } = request.params;

    const getTodoQuery = `
    SELECT
      *
    FROM
      todo
    WHERE
      id = ${todoId};`;
    const todo = await database.get(getTodoQuery);
    response.send(convertTodoDbObjectToResponseObject(todo));
  }
);

app.put(
  "/todos/:todoId/",
  validateValuesMiddlewareQuery,
  validateValuesMiddlewareBody,
  async (request, response) => {
    const { todoId } = request.params;
    let updateColumn = "";
    const requestBody = request.body;
    switch (true) {
      case requestBody.status !== undefined:
        updateColumn = "Status";
        break;
      case requestBody.priority !== undefined:
        updateColumn = "Priority";
        break;
      case requestBody.todo !== undefined:
        updateColumn = "Todo";
        break;
      case requestBody.category !== undefined:
        updateColumn = "Category";
        break;
      case requestBody.dueDate !== undefined:
        updateColumn = "Due Date";
        break;
    }
    const previousTodoQuery = `
    SELECT
      *
    FROM
      todo
    WHERE 
      id = ${todoId};`;
    const previousTodo = await database.get(previousTodoQuery);

    const {
      todo: updatedTodo = previousTodo.todo,
      priority: updatedPriority = previousTodo.priority,
      status: updatedStatus = previousTodo.status,
      category: updatedCategory = previousTodo.category,
      dueDate: updatedDueDate = previousTodo.due_date,
    } = request.body;

    const updateTodoQuery = `
    UPDATE
      todo
    SET
      todo='${updatedTodo}',
      priority='${updatedPriority}',
      status='${updatedStatus}',
      category = '${updatedCategory}',
      due_date = '${updatedDueDate}'
    WHERE
      id = ${todoId};`;

    await database.run(updateTodoQuery);
    response.send(`${updateColumn} Updated`);
  }
);

app.delete(
  "/todos/:todoId/",
  validateValuesMiddlewareQuery,
  async (request, response) => {
    const { todoId } = request.params;
    const deleteTodoQuery = `
  DELETE FROM
    todo
  WHERE
    id = ${todoId};`;

    await database.run(deleteTodoQuery);
    response.send("Todo Deleted");
  }
);

module.exports = app;
