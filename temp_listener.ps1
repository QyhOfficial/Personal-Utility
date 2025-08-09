$listener = [System.Net.Sockets.TcpListener]10086
$listener.Start() # 停止监听: $listener.Stop()
netstat -ano | findstr :10086