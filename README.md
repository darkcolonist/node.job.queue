# node.job.queue
nodejs background job queue

*usage:*
-----
send a url-encoded data to localhost:1028/enqueue

   *queue* = the name of the queue this job will be enqueued
   *url* = the url that will be called
   *data* = (optional) the data that will be passed as url-encoded to url via POST
   *callback* = (optional) the url that will be called later after the job is completed, { url, data } as well as url's response will be forwarded back to callback via POST