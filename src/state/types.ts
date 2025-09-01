export type ID = string;

// A Task is one row in your task list.
export type Task = {
  id: ID;         // unique id (random string)
  title: string;      // the task name the user typed
  createdAt: number;  // when it was created (milliseconds since 1970)
  defaultDurationSec?: number; //default task duration, e.g. 180 for 3 minutes
};

// A task in a queue
export type QueueItem = {
  id: ID;               // unique id for the queue row
  taskId: ID;           // points to a Task
  durationSec: number;  // per-item duration override
}