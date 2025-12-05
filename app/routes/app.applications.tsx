import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getSupabaseAdmin } from "../supabase.server";

interface Member {
  id: string;
  member_number: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  created_at: string;
}

interface LoaderData {
  members: Member[];
  error: string | null;
}

interface ActionData {
  success?: boolean;
  action?: string;
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const supabase = getSupabaseAdmin();

    const { data: members, error } = await supabase
      .from("members")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching members:", error);
      return { members: [], error: error.message };
    }

    return { members: members || [], error: null };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { members: [], error: "Failed to load applications" };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const memberId = formData.get("memberId") as string;
    const actionType = formData.get("action") as string;

    if (!memberId || !actionType) {
      return { success: false, error: "Missing required fields" };
    }

    // For approve action, use the FastAPI backend endpoint with atomic transactions
    if (actionType === "approve") {
      const backendUrl = process.env.BACKEND_URL || "https://aura-shopify-production.up.railway.app";
      const approveUrl = `${backendUrl}/api/members/admin/approve/${memberId}`;

      const response = await fetch(approveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        console.error("Backend approval error:", errorData);
        return {
          success: false,
          error: errorData.detail || "Failed to approve member"
        };
      }

      const result = await response.json();
      return {
        success: true,
        action: actionType,
        message: result.message || "Member approved successfully"
      };
    }

    // For reject and waitlist, update status directly via Supabase
    // These don't affect the 500 member limit, so no atomic transaction needed
    const supabase = getSupabaseAdmin();

    let newStatus: string;
    switch (actionType) {
      case "reject":
        newStatus = "inactive";
        break;
      case "waitlist":
        newStatus = "waitlisted";
        break;
      default:
        return { success: false, error: "Invalid action" };
    }

    const { error } = await supabase
      .from("members")
      .update({ status: newStatus })
      .eq("id", memberId);

    if (error) {
      console.error("Error updating member:", error);
      return { success: false, error: error.message };
    }

    return { success: true, action: actionType };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { success: false, error: "Failed to update application" };
  }
};

export default function Applications() {
  const { members, error } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<ActionData>();
  const shopify = useAppBridge();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isProcessing = fetcher.state === "submitting" || fetcher.state === "loading";

  useEffect(() => {
    if (fetcher.data?.success && !isProcessing) {
      shopify.toast.show(`Application ${fetcher.data.action}d successfully`);
      setProcessingId(null);
    } else if (fetcher.data?.error && !isProcessing) {
      shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
      setProcessingId(null);
    }
  }, [fetcher.data, isProcessing, shopify]);

  const handleAction = (memberId: string, action: string) => {
    setProcessingId(memberId);
    fetcher.submit(
      { memberId, action },
      { method: "POST" }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <s-page heading="Primal 500 Member Applications">
      <style>{`
        .primal-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .primal-table thead tr {
          border-bottom: 2px solid #C19A6B;
          background: linear-gradient(to bottom, #FAF7F2 0%, #FEFEFE 100%);
        }
        .primal-table th {
          padding: 16px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 14px;
          color: #2B2B2B;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .primal-table tbody tr {
          border-bottom: 1px solid #E5E5E5;
          transition: background-color 0.2s ease;
        }
        .primal-table tbody tr:hover {
          background-color: #FAF7F2;
        }
        .primal-table td {
          padding: 16px 12px;
          color: #2B2B2B;
          font-size: 14px;
        }
        .primal-member-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 48px;
          height: 28px;
          padding: 0 12px;
          background: linear-gradient(135deg, #C19A6B 0%, #D4AF37 100%);
          color: white;
          font-weight: 700;
          font-size: 13px;
          border-radius: 14px;
          letter-spacing: 0.5px;
        }
        .primal-name {
          font-weight: 500;
        }
        .primal-email {
          color: #666;
          font-size: 13px;
        }
        .primal-stats-card {
          background: linear-gradient(135deg, #FAF7F2 0%, #FEFEFE 100%);
          border: 1px solid #C19A6B;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .primal-stat-number {
          font-size: 32px;
          font-weight: 700;
          color: #C19A6B;
          font-family: 'Playfair Display', serif;
        }
        .primal-stat-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666;
          margin-top: 4px;
        }
        .primal-empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #666;
        }
        .primal-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
        }
      `}</style>

      <s-section heading="Pending Applications">
        {error && (
          <s-banner tone="critical">
            <s-paragraph>Error loading applications: {error}</s-paragraph>
          </s-banner>
        )}

        {members.length === 0 ? (
          <s-box padding="large" className="primal-empty-state">
            <div className="primal-empty-icon">✓</div>
            <s-text>No pending applications to review</s-text>
            <s-paragraph>All caught up! New applications will appear here.</s-paragraph>
          </s-box>
        ) : (
          <s-box>
            <table className="primal-table">
              <thead>
                <tr>
                  <th>Member #</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Applied</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: Member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="primal-member-number">
                        #{member.member_number || "—"}
                      </span>
                    </td>
                    <td className="primal-name">
                      {member.first_name} {member.last_name}
                    </td>
                    <td className="primal-email">{member.email}</td>
                    <td>{formatDate(member.created_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      <s-stack direction="inline" gap="base">
                        <s-button
                          variant="primary"
                          onClick={() => handleAction(member.id, "approve")}
                          {...(processingId === member.id && isProcessing
                            ? { loading: true, disabled: true }
                            : {})}
                        >
                          Approve
                        </s-button>
                        <s-button
                          onClick={() => handleAction(member.id, "waitlist")}
                          {...(processingId === member.id && isProcessing
                            ? { disabled: true }
                            : {})}
                        >
                          Waitlist
                        </s-button>
                        <s-button
                          variant="tertiary"
                          tone="critical"
                          onClick={() => handleAction(member.id, "reject")}
                          {...(processingId === member.id && isProcessing
                            ? { disabled: true }
                            : {})}
                        >
                          Reject
                        </s-button>
                      </s-stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-box>
        )}
      </s-section>

      <s-section slot="aside" heading="Member Queue">
        <div className="primal-stats-card">
          <div className="primal-stat-number">{members.length}</div>
          <div className="primal-stat-label">Pending Applications</div>
        </div>
        <s-paragraph>
          Review and approve applications for the Primal 500 exclusive membership program.
          Each approved member receives unique access to AI-powered shopping concierge and
          Coach Chris fitness advisor.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Approval Actions">
        <s-unordered-list>
          <s-list-item>
            <strong>Approve:</strong> Grant full member access and assign member number (1-500)
          </s-list-item>
          <s-list-item>
            <strong>Waitlist:</strong> Hold application until membership spots become available
          </s-list-item>
          <s-list-item>
            <strong>Reject:</strong> Decline application and notify applicant
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};