# --------------------------------------------------------------------------------------------
# create channels,join peer nodes to the channel,install chaincodes and instantiate chaincodes
# --------------------------------------------------------------------------------------------

jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
	echo "Please Install 'jq' to execute this script"
	echo
	exit 1
fi
sleep 5
starttime=$(date +%s)

# Language defaults to "golang"
LANGUAGE="golang"
CCNAME="safedoc"
CCVERSION="v0"

##set chaincode path
function setChaincodePath(){
	LANGUAGE=`echo "$LANGUAGE" | tr '[:upper:]' '[:lower:]'`
	case "$LANGUAGE" in
		"golang")
		CC_SRC_PATH="chaincode"
		;;
		"node")
		CC_SRC_PATH="$PWD/artifacts/src/chaincode"
		;;
		*) printf "\n ------ Language $LANGUAGE is not supported yet ------\n"$
		exit 1
	esac
}
# Creating New Affiliation
# =============================================================================================

echo "Creating New Affiliation: Client1.department1"
echo
RESP=$(curl -s -X POST \
  http://localhost:4002/api/v1/newAffiliation \
  -H "content-type: application/json" \
  -d '{
    "orgName":"Client1",
    "affiliation":"department1"
}')
echo " $RESP"

echo "Creating New Affiliation: Client2.department1"
echo
RESP=$(curl -s -X POST \
  http://localhost:4002/api/v1/newAffiliation \
  -H "content-type: application/json" \
  -d '{
    "orgName":"Client2",
    "affiliation":"department1"
}')
echo " $RESP"

echo "Creating New Affiliation: Client3.department1"
echo
RESP=$(curl -s -X POST \
  http://localhost:4002/api/v1/newAffiliation \
  -H "content-type: application/json" \
  -d '{
    "orgName":"Client3",
    "affiliation":"department1"
}')
echo " $RESP"


setChaincodePath
sleep 2
#===========================================================================================================================
echo "POST request Enroll on Client1  ..."
echo
ORG1_TOKEN=$(curl -s -X POST \
  http://localhost:4002/api/v1/auth_user \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Client1Admin&orgName=Client1')
echo $ORG1_TOKEN
ORG1_TOKEN=$(echo $ORG1_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG1 token is $ORG1_TOKEN"
echo
#===========================================================================================================================
echo "POST request Enroll on Client2 ..."
echo
ORG2_TOKEN=$(curl -s -X POST \
  http://localhost:4002/api/v1/auth_user \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Client2Admin&orgName=Client2')
echo $ORG2_TOKEN
ORG2_TOKEN=$(echo $ORG2_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG2 token is $ORG2_TOKEN"
echo
echo
#===========================================================================================================================
echo "POST request Enroll on Client3 ..."
echo
ORG3_TOKEN=$(curl -s -X POST \
  http://localhost:4002/api/v1/auth_user \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Client3Admin&orgName=Client3')
echo $ORG3_TOKEN
ORG3_TOKEN=$(echo $ORG3_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG2 token is $ORG3_TOKEN"
echo
echo
#===========================================================================================================================
echo "POST request Create channel  ..."
echo
curl -s -X POST \
  http://localhost:4002/api/v1/create_channels \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"channelName":"cievus-safedoc-channel",
	"channelConfigPath":"../artifacts/channel/cievus-safedoc-channel.tx"
}'
echo
echo
sleep 3
#===========================================================================================================================
echo "POST request Join channel on Client1"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/join_channels/cievus-safedoc-channel/peers \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.client1.cievus.com"]
}'
echo
echo
#===========================================================================================================================
echo "POST request Join channel on Client2"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/join_channels/cievus-safedoc-channel/peers \
  -H "authorization: Bearer $ORG2_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.client2.cievus.com"]
}'
echo
echo
#===========================================================================================================================
echo "POST request Join channel on Client3"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/join_channels/cievus-safedoc-channel/peers \
  -H "authorization: Bearer $ORG3_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.client3.cievus.com"]
}'
echo
echo
#===========================================================================================================================
echo "POST Install chaincode on Client1"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/install_chaincodes \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.client1.cievus.com\"],
	\"chaincodeName\":\"$CCNAME\",
	\"chaincodePath\":\"$CC_SRC_PATH\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"chaincodeVersion\":\"$CCVERSION\"
}"
echo
echo
#===========================================================================================================================
echo "POST Install chaincode on Client2"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/install_chaincodes \
  -H "authorization: Bearer $ORG2_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.client2.cievus.com\"],
	\"chaincodeName\":\"$CCNAME\",
	\"chaincodePath\":\"$CC_SRC_PATH\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"chaincodeVersion\":\"$CCVERSION\"
}"
echo
#===========================================================================================================================
echo "POST Install chaincode on Client3"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/install_chaincodes \
  -H "authorization: Bearer $ORG3_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.client3.cievus.com\"],
	\"chaincodeName\":\"$CCNAME\",
	\"chaincodePath\":\"$CC_SRC_PATH\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"chaincodeVersion\":\"$CCVERSION\"
}"
echo


#===========================================================================================================================
echo "POST instantiate chaincode on peer1 of Client1"
echo
curl -s -X POST \
  http://localhost:4002/api/v1/instantiate_chaincode/cievus-safedoc-channel/chaincodes \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d "{
  \"peers\": [\"peer0.client1.cievus.com\",\"peer0.client2.cievus.com\",\"peer0.client3.cievus.com\"],
	\"chaincodeName\":\"$CCNAME\",
	\"chaincodeVersion\":\"$CCVERSION\",
	\"chaincodeType\": \"$LANGUAGE\",
  \"args\":[\" \"]
}"
#===========================================================================================================================

echo
echo "Total execution time : $(($(date +%s)-starttime)) secs ..."
