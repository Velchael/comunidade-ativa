aws ecr get-login-password --region us-east-1 --profile casapazreact | docker login --username AWS --password-stdin 471112700544.dkr.ecr.us-east-1.amazonaws.com
docker build -t casapazreact .
docker tag casapazreact:latest 471112700544.dkr.ecr.us-east-1.amazonaws.com/casapazreact:latest
docker push 471112700544.dkr.ecr.us-east-1.amazonaws.com/casapazreact:latest
