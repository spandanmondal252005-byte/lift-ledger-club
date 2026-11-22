import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { startWorkout, type WorkoutPayload } from "@/lib/api/workouts";
import { errorMessage } from "@/lib/format";

export function useStartWorkout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args?: { name?: string; template?: WorkoutPayload["exercises"] }) =>
      startWorkout(args?.name ?? defaultWorkoutName(), args?.template),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sessions", "active"] });
      navigate({ to: "/workout/$sessionId", params: { sessionId: id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function defaultWorkoutName(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 11) return "Morning Workout";
  if (h < 16) return "Afternoon Workout";
  if (h < 21) return "Evening Workout";
  return "Night Workout";
}
