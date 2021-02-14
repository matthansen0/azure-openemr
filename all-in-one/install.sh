# Install Prerequisites 
sudo apt update
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update

sudo apt install docker -y
sudo apt install docker-compose -y
sudo systemctl enable docker

# Download and run sample docker compose file
wget https://raw.githubusercontent.com/matthansen0/azure-openemr/dev/all-in-one/docker-compose.yml
docker-compose up -d

# Checking Web Service Status
while [ "$status" != 0 ]
do
    status=$(timeout 2 bash -c "</dev/tcp/127.0.0.1/80")
    sleep 1
done