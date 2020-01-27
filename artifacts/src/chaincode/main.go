package main

import (
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const prefixFile = "FLID"
const projectName = "Cievus-safe-doc-app"
const version = "v1"

var logger = shim.NewLogger("cievus-Safe_Doc-app:")

// SmartContract function
type SmartContract struct {
}

// Init method
func (s *SmartContract) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("*** " + projectName + " *** " + version + " Init ***")
	return shim.Success(nil)
}

// Invoke methos
func (s *SmartContract) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("*** " + projectName + " *** " + version + " Invoke ***")
	function, args := stub.GetFunctionAndParameters()
	logger.Info("Function: " + function)
	switch function {
	case "uploadFile":
		return s.uploadFile(stub, args)
	case "downloadFile":
		return s.downloadFile(stub, args)
	case "queryFileByFileID":
		return s.queryFileByFileID(stub, args)
	case "getFileHistory":
		return s.getFileHistory(stub, args)
	case "approveDocument":
		return s.approveDocument(stub, args)
	case "approvalStatus":
		return s.approvalStatus(stub, args)
	default:
		jsonResp := "{\"status\":false,\"description\":\"Invalid Smart Contract function name.\"}"
		return shim.Error(jsonResp)
	}
}

func main() {
	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
