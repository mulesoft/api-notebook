# Execution

## Script load helper

A `load` function is provided which can be used to load script URLs into the execution environment. It accepts a url to load and an optional callback function.

## Async code cells

An `async` function is provided to help with executing async code cells. Executing the function once will return a new function and force the cell into async mode. You can then call the returned function with `error` and `result` parameters (in that order) to end the async execution. There is a safeguard timeout of 2000ms (which can be changed by calling `timeout`) that stops the cell from never ending in case of a badly writting async function (this won't magically fix broken async code, it will still be running).
