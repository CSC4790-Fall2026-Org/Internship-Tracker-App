import type { Application, AppStatus } from "@shared/data/types";
import { useData } from "@shared/data/DataContext";
import { STATUS, STATUS_ORDER } from "@shared/data/status";
import { chooseAction, errorMessage, useToast } from "@/components/feedback";
import { haptic } from "@/lib/haptics";

/**
 * Moving an application to another stage, with the same messages as the website's Board and detail page.
 * DataContext updates the screen straight away and fills in the applied date when it leaves Wishlist.
 */
export function useChangeStatus() {
  const { updateApplication } = useData();
  const toast = useToast();

  const changeStatus = async (app: Application, status: AppStatus) => {
    if (app.status === status) return;
    if (status === "offer") {
      haptic.success();
      toast(`Congrats on the offer from ${app.company}! 🎉`);
    }
    try {
      await updateApplication(app.id, { status });
      if (status !== "offer") toast(`${app.company} moved to ${STATUS[status].label}`);
    } catch (e) {
      toast(`Couldn't move ${app.company}: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  /** The "Move to…" menu: every other stage. */
  const pickStatus = (app: Application) =>
    chooseAction(
      `Move ${app.company} to…`,
      STATUS_ORDER.filter((s) => s !== app.status).map((s) => ({ label: STATUS[s].label, onPress: () => changeStatus(app, s) })),
    );

  return { changeStatus, pickStatus };
}
