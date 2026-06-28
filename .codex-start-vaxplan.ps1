Set-Location 'C:\vaxplan-main'
foreach($file in @('.env','.env.runtime.local')){
  if(Test-Path $file){
    Get-Content -LiteralPath $file | ForEach-Object {
      $line=$_.Trim()
      if($line -and -not $line.StartsWith('#') -and $line.Contains('=')){
        $name,$value=$line.Split('=',2)
        $name=$name.Trim()
        if($name -ne 'PATH' -and $name -ne 'Path'){
          $value=$value.Trim().Trim('"').Trim("'")
          Set-Item -Path "env:$name" -Value $value
        }
      }
    }
  }
}
$env:SKIP_DB_BOOTSTRAP='1'
$env:SKIP_OUTSIDE_VILLAGES_CACHE='1'
$env:NODE_ENV='production'
node.exe dist/index.cjs *> 'C:\vaxplan-main\vaxplan-server.log'
