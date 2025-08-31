// A Task is one row in your task list.
export type Task = {
  id: string;         // unique id (random string)
  title: string;      // the task name the user typed
  createdAt: number;  // when it was created (milliseconds since 1970)
};