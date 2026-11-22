import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExercise, updateExercise, type Exercise } from "@/lib/api/exercises";
import { EQUIPMENT, MUSCLE_CATEGORIES, categoryLabel, equipmentLabel } from "@/lib/exercise-meta";
import { errorMessage } from "@/lib/format";

export function ExerciseFormDialog({
  open,
  onOpenChange,
  userId,
  exercise,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  exercise?: Exercise | null;
  onSaved?: (e: Exercise) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("chest");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [equipment, setEquipment] = useState<string>("barbell");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(exercise?.name ?? "");
    setCategory(exercise?.category ?? "chest");
    setPrimary(exercise?.primary_muscle ?? "");
    setSecondary((exercise?.secondary_muscles ?? []).join(", "));
    setEquipment(exercise?.equipment ?? "barbell");
    setInstructions(exercise?.instructions ?? "");
  }, [open, exercise]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        category,
        primary_muscle: primary.trim() || categoryLabel(category),
        secondary_muscles: secondary
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        equipment,
        instructions: instructions.trim() || null,
      };
      return exercise ? updateExercise(exercise.id, payload) : createExercise(userId, payload);
    },
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      qc.invalidateQueries({ queryKey: ["exercise", e.id] });
      toast.success(exercise ? "Exercise updated" : "Custom exercise created");
      onSaved?.(e);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Give the exercise a name (at least 2 characters).");
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{exercise ? "Edit exercise" : "New custom exercise"}</DialogTitle>
          <DialogDescription>Custom exercises are private to your account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" maxLength={80} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Equipment">
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT.map((e) => (
                    <SelectItem key={e} value={e}>
                      {equipmentLabel(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Target muscle">
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="e.g. Upper chest" />
          </Field>
          <Field label="Secondary muscles" hint="Separate with commas">
            <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="Triceps, Front delts" />
          </Field>
          <Field label="Instructions">
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Setup and cues…" />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {exercise ? "Save changes" : "Create exercise"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline justify-between">
        {label}
        {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}
