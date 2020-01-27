# ---------------------------------------------------------------------------
# Generate certificates using cryptogen tool
# ---------------------------------------------------------------------------

CHANNEL_NAME="cievus-safedoc-channel"

which cryptogen
if [ "$?" -ne 0 ]; then
echo "cryptogen tool not found. exiting..."
exit 1
fi
  echo
  echo "----------------------------------------------------------"
  echo "##### Generate certificates using cryptogen tool #########"
  echo "----------------------------------------------------------"
    if [ -d "crypto-config" ]; then
    rm -Rf crypto-config
  fi
  cryptogen generate --config=cryptogen.yaml
  if [ "$?" -ne 0 ]; then
    echo "Failed to generate certificates..."
    exit 1
  fi
  echo "Successfully Generated certificates using cryptogen tool"

#-----------------------------------------------------------------------------
# Generate genesis block ,channel.tx and anchor peer using configtxgen tool
#-----------------------------------------------------------------------------
     which configtxgen
  if [ "$?" -ne 0 ]; then
    echo "configtxgen tool not found. exiting..."
    exit 1
  fi

  echo "-----------------------------------------------------"
  echo "#########  Generating Orderer Genesis block #########"
  echo "-----------------------------------------------------"

  configtxgen -profile Cievus-safedoc-Genesis -outputBlock ./genesis.block
  if [ "$?" -ne 0 ]; then
    echo "Failed to generate orderer genesis block..."
    exit 1
  fi
  echo
  echo "--------------------------------------------------------------------------------"
  echo "### Generating channel configuration transaction 'cievus-safedoc-channel.tx' ###"
  echo "--------------------------------------------------------------------------------"
  configtxgen -profile Cievus-safedoc-channel -outputCreateChannelTx ./cievus-safedoc-channel.tx -channelID $CHANNEL_NAME
  if [ "$?" -ne 0 ]; then
    echo "Failed to generate channel configuration transaction..."
    exit 1
  fi

  echo
  echo "--------------------------------------------------------------------------------"
  echo "#######  Generating anchor peer update  Client1, Client2 and Client3 ###########"
  echo "--------------------------------------------------------------------------------"
  configtxgen -profile Cievus-safedoc-channel -outputAnchorPeersUpdate ./Client1MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Client1MSP
  configtxgen -profile Cievus-safedoc-channel -outputAnchorPeersUpdate ./Client2MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Client2MSP
  configtxgen -profile Cievus-safedoc-channel -outputAnchorPeersUpdate ./Client3MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Client3MSP
  if [ "$?" -ne 0 ]; then
    echo "Failed to generate anchor peer ..."
    exit 1
  fi
