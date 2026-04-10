import { NextRequest, NextResponse } from "next/server";
import { getFirestore, collection, doc, addDoc, updateDoc, getDocs, query, where, orderBy, getDoc } from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase-config";

const db = getFirestore(firebaseApp);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      account_id,
      tsm_reference_id,
      original_data,
      proposed_changes,
      edited_by,
      edited_by_name,
    } = body;

    const docRef = await addDoc(collection(db, "customer_edit_approvals"), {
      account_id,
      tsm_reference_id,
      original_data,
      proposed_changes,
      status: "pending",
      edited_by,
      edited_by_name,
      approved_by: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Edit approval request submitted",
      approval_id: docRef.id,
    });
  } catch (error) {
    console.error("Error creating edit approval:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit edit approval request" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tsm_reference_id = searchParams.get("tsm_reference_id");
    const status = searchParams.get("status");

    // Build query without orderBy to avoid composite index requirement
    const constraints = [];
    
    if (tsm_reference_id) {
      constraints.push(where("tsm_reference_id", "==", tsm_reference_id));
    }

    if (status) {
      constraints.push(where("status", "==", status));
    }

    const q = query(collection(db, "customer_edit_approvals"), ...constraints);
    const querySnapshot = await getDocs(q);
    
    let approvals = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Client-side sorting by created_at desc
    approvals.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    console.error("Error fetching edit approvals:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch edit approval requests" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { approval_id, status, approved_by, rejection_reason } = body;

    if (!approval_id || !status) {
      return NextResponse.json(
        { success: false, message: "Missing approval_id or status" },
        { status: 400 }
      );
    }

    const approvalRef = doc(db, "customer_edit_approvals", approval_id);
    const approvalDoc = await getDoc(approvalRef);

    if (!approvalDoc.exists()) {
      return NextResponse.json(
        { success: false, message: "Approval request not found" },
        { status: 404 }
      );
    }

    const approval = approvalDoc.data();

    // If approving, apply the changes to the accounts table via API
    if (status === "approved") {
      const proposedChanges = approval.proposed_changes;

      // Update the account with proposed changes via the existing edit API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/com-edit-account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: approval.account_id,
          ...proposedChanges,
          status: "active",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to apply changes to account");
      }
    }

    // Update approval status in Firebase
    await updateDoc(approvalRef, {
      status,
      approved_by: approved_by || null,
      rejection_reason: rejection_reason || null,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: status === "approved" ? "Changes approved and applied" : "Request rejected",
    });
  } catch (error) {
    console.error("Error updating edit approval:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update approval request" },
      { status: 500 }
    );
  }
}
