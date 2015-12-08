<?php defined('SYSPATH') or die('No direct script access.');
class JobQueue {
  /**
   * usage:
   * $status = jobqueue::enqueue(
   *   url::base(true, "https")."api/send/long_running_process",    // url                
   *   $data,                                                       // data               
   *   $queue_name,                                                 // queue (optional)   
   *   url::base(true, "http")."api/send/long_running_process_cb"); // callback (optional)
   *
   * echo $status["http_code"] . ": ".$status["response"];
   * 
   * @param  string $url      url to be called
   * @param  array  $data     data to be passed to url
   * @param  string $queue    name of the queue this job will be assigned to (optional)
   * @param  string $callback url to be called after the job completes (optional)
   * @return array            status of the job
   */
  static function enqueue($url, $data, $queue = "main", $callback = null){
    /**
     * this is the url of the job-queue
     * change this based on your preference
     * NOTE: without the trailing forwardslash!
     * @var string
     */
    $job_queue_url = "http://localhost:1028";

    $status = array();
    $job_queue_url .= "/enqueue";
    $fields = array(
      'queue'    => $queue,
      'url'      => $url,
      'data'     => $data,
      'callback' => $callback
    );

    $fields_string = http_build_query($fields);

    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $job_queue_url);
    curl_setopt($ch, CURLOPT_FRESH_CONNECT, true);
    // curl_setopt($ch, CURLOPT_TIMEOUT_MS, 1);
    // curl_setopt($ch, CONNECTION_TIMEOUT, .5);
    curl_setopt($ch, CURLOPT_POST, count($fields));
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fields_string);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_VERBOSE, 0);
     
    $status["response"]   = curl_exec($ch);
    $status["http_code"]  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $status["total_time"] = curl_getinfo($ch, CURLINFO_TOTAL_TIME);

    curl_close($ch);
  
    return $status;
  }
}