var myApp = angular.module('myApp', []);

myApp
  .factory('socket', function(){
    return io.connect()
  })
  .controller('AppCtrl', ['$scope', 'socket', function($scope, socket){    
    $scope.queues = []

    socket.on('status', function(data){
      $scope.queues = data.queues
      $scope.tasks = data.tasks
      $scope.$digest()
    })

    socket.on('queue:fetch_errors', function(data){
      $scope.error = data
      $scope.$digest();
    })

    $scope.resume_queue = function(name){
      socket.emit('queue:resume', name)
    }

    $scope.pause_queue = function(name){
      socket.emit('queue:pause', name)
    }

    $scope.fetch_errors = function(name){
      socket.emit('queue:fetch_errors', name)
    }

}]);