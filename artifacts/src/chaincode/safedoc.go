package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (s *SmartContract) uploadFile(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	logger.Info("***" + projectName + "***" + version + "Upload file to blockchain ledger ***")

	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5")
	}

	file := File{}
	file.FileID = args[0]
	file.FileName = args[1]
	file.Hash = args[2]
	file.Mimetype = args[3]
	file.CreationDate = time.Now()
	file.CreatedByID = args[4]
	file.Version = 0

	if file.FileID == "" {
		return shim.Error("File ID can't be empty")
	}
	if file.FileName == "" {
		return shim.Error("File name can't be empty")
	}
	if file.Hash == "" {
		return shim.Error("File data can't be empty")
	}

	key, err := stub.CreateCompositeKey(prefixFile, []string{args[0]})
	if err != nil {
		return shim.Error(err.Error())
	}
	// Check if the File already exist
	fileAsBytes, _ := stub.GetState(key)
	if fileAsBytes != nil {
		fileHistory := File{}
		err = json.Unmarshal(fileAsBytes, &fileHistory)
		file.Version = fileHistory.Version + 1
	}

	fileAsBytes, err = json.Marshal(file)

	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(key, fileAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success([]byte("File uploaded successfully"))
}

func (s *SmartContract) downloadFile(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	logger.Info("***" + projectName + "***" + version + "Download file ***")
	logger.Info(args[0])
	key, err := stub.CreateCompositeKey(prefixFile, []string{args[0]})
	if err != nil {
		return shim.Error(err.Error())
	}
	fileAsBytes, _ := stub.GetState(key)
	if fileAsBytes == nil {
		return shim.Error("Invalid file referrance, No file exist")
	}
	return shim.Success(fileAsBytes)
}

func (s *SmartContract) getFileHistory(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	logger.Info("***" + projectName + "***" + version + "Get History of A File ***")
	if len(args) < 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}
	logger.Info("Getting history of File No:" + args[0])
	key, _ := stub.CreateCompositeKey(prefixFile, []string{args[0]})
	resultsIterator, err := stub.GetHistoryForKey(key)
	if err != nil {
		return shim.Error("{\"status\":false,\"description\":\"" + err.Error() + "\"}")
	}
	defer resultsIterator.Close()
	// buffer is a JSON array containing historic values for the invoice
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return shim.Error("{\"status\":false,\"description\":\"" + err.Error() + "\"}")
		}
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"value\":")
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"isDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")
	logger.Info("History: \n" + buffer.String())
	return shim.Success(buffer.Bytes())
}

func (s *SmartContract) queryFileByFileID(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	fileid := strings.ToLower(args[0])

	queryString := fmt.Sprintf("{\"selector\":{\"docType\":\"File\",\"FileID\":\"%s\"}}", fileid)

	queryResults, err := getQueryResultForQueryString(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResults)
}

func (s *SmartContract) approveDocument(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	logger.Info("***" + projectName + "***" + version + "Approve File ***")
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}
	//args[0]--- FileID
	key, err := stub.CreateCompositeKey(prefixFile, []string{args[0]})
	if err != nil {
		return shim.Error(err.Error())
	}
	// Check if the File already exist
	fileAsBytes, _ := stub.GetState(key)
	if fileAsBytes == nil {
		return shim.Error("Invalid FileID")
	}
	file := File{}
	err = json.Unmarshal(fileAsBytes, &file)
	file.ApproveStatus = args[1]
	file.ApproverID = args[2]
	file.ApproveDate = time.Now()
	fileAsBytes, err = json.Marshal(file)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(key, fileAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success([]byte("File approved successfully"))
}

func (s *SmartContract) approvalStatus(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	logger.Info("***" + projectName + "***" + version + "Download file ***")
	key, err := stub.CreateCompositeKey(prefixFile, []string{args[0]})
	if err != nil {
		return shim.Error(err.Error())
	}
	fileAsBytes, _ := stub.GetState(key)
	if fileAsBytes == nil {
		return shim.Error("Invalid file referrance, No file exist")
	}
	file := File{}
	err = json.Unmarshal(fileAsBytes, &file)
	fileAsBytes, err = json.Marshal(file)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(fileAsBytes)
}

func getQueryResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {

	fmt.Printf("- getQueryResultForQueryString queryString:\n%s\n", queryString)

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryRecords
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- getQueryResultForQueryString queryResult:\n%s\n", buffer.String())

	return buffer.Bytes(), nil
}
