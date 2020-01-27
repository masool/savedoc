package main

import "time"

// File details
type File struct {
	FileID        string    `json:"File_ID"`
	FileName      string    `json:"File_Name"`
	Hash          string    `json:"Hash"`
	Version       int       `json:"Version"`
	Mimetype      string    `json:"Mimetype"`
	CreationDate  time.Time `json:"Creation_Date"`
	CreatedByID   string    `json:"Created_By_Id"`
	ApproveStatus string    `json:"Approve_Status"`
	ApproverID    string    `json:"Approver_ID"`
	ApproveDate   time.Time `json:"Approve_Date"`
}
