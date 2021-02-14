sudo apt update
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update

sudo apt install docker -y
sudo apt install docker-compose -y

wget https://raw.githubusercontent.com/matthansen0/azure-openemr/dev/all-in-one/docker-compose.yml

docker-compose up >> open-emr-docker-compose-status.log