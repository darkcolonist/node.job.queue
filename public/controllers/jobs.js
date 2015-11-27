var myApp = angular.module('myApp', []);

myApp.controller('AppCtrl', ['$scope', '$http', function($scope, $http){
  // var refresh_jobs = function() {
  //   $http.get('/jobs').success(function(response){
  //     $scope.jobs = response;

  //     setTimeout(refresh_jobs, 3000);
  //   }).error(function(){
  //     // error occured, try again after some time
  //     setTimeout(refresh_jobs, 10000);
  //   });
  // }

  // refresh_jobs();

  var refresh_status = function() {
    $http.get('/status').success(function(response){
      $scope.queues = response.queues;

      setTimeout(refresh_status, 3000);
    }).error(function(){
      // error occured, try again after some time
      setTimeout(refresh_status, 10000);
    });
  }

  refresh_status();
}]);