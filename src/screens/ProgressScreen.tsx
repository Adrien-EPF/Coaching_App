import React from "react";
import { Card, Screen, Txt } from "../ui/kit";

export function ProgressScreen() {
  return (
    <Screen title="Progrès">
      <Card>
        <Txt kind="heading">Bientôt</Txt>
        <Txt muted>Tes records et ton 1RM estimé apparaîtront ici une fois les séances enregistrées.</Txt>
      </Card>
    </Screen>
  );
}
