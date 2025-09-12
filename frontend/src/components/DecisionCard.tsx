"use client";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { postJSON } from "@/lib/api";

export default function DecisionCard(){
  async function accept(){
    try {
      await postJSON("/decisions", { action: "accept", proposalId: "hold-123-2m" });
      toast.success("Accepted. Re-simulating…");
    } catch {
      toast.error("Failed to submit decision");
    }
  }
  async function reject(){
    try {
      await postJSON("/decisions", { action: "reject", proposalId: "hold-123-2m" });
      toast("Rejected");
    } catch {
      toast.error("Failed to submit decision");
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Hold Train 123 for 2 mins → Saves 14 mins overall</div>
      </CardHeader>
      <CardContent>
        <div className="text-sm opacity-80">Why this works: Reduces conflict near Kanpur Jn by sequencing faster train first.</div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={accept}>Accept</Button>
        <Button variant="secondary" onClick={reject}>Reject</Button>
      </CardFooter>
    </Card>
  );
}

