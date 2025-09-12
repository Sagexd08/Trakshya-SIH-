"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function ScenarioModal(){
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("fog");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>What-If</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Run Simulation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select className="bg-neutral-800 rounded px-2 py-1" value={type} onChange={(e)=>setType(e.target.value)}>
            <option value="fog">Fog</option>
            <option value="breakdown">Breakdown</option>
            <option value="closure">Track Closure</option>
          </select>
          <AnimatePresence mode="wait">
            <motion.div key={type} initial={{opacity:0, y:4}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-4}} className="text-sm opacity-80">
              {type === "fog" && "Expect reduced speeds and increased headway limits."}
              {type === "breakdown" && "A blocked block section will reroute nearby trains."}
              {type === "closure" && "Long-distance closure will require alternative paths."}
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-end"><Button onClick={()=> setOpen(false)}>Run</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

