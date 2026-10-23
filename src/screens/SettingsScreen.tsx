import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Share, View } from "react-native";
import type { RootParams } from "../navigation";
import { AppearanceChoice, getAppearance, setAppearance } from "../config/appearance";
import { callGemini } from "../planner/geminiApi";
import { clearGeminiKey, getGeminiKey, setGeminiKey } from "../config/geminiKey";
import { exportCsv, exportJson, importJson } from "../data/backup";
import { useAction, useStore } from "../data/RepoContext";
import { Button, Card, Chip, ErrorText, Field, SectionLabel, Sheet, Split, Txt } from "../ui/kit";
import { Screen } from "../ui/kit";
import { space } from "../ui/theme";

/** Réglages: the appearance, the Gemini API key (kept on this device only) and the data. */
export function SettingsScreen() {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => getGeminiKey().then((k) => setSaved(!!k), () => setSaved(false));
  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    if (!key.trim()) return setError("Colle ta clé API Gemini.");
    try {
      await setGeminiKey(key);
      setKey("");
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const k = key.trim() || (await getGeminiKey());
      if (!k) throw new Error("Aucune clé à tester.");
      await callGemini(k, 'Reply with the JSON {"ok": true}');
      setResult("La clé fonctionne.");
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    try {
      await clearGeminiKey();
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const navigation = useNavigation<NavigationProp<RootParams>>();
  return (
    <Screen title="Réglages" onBack={() => navigation.goBack()}>
      <View style={{ gap: space[2] }}>
        <SectionLabel>Gemini</SectionLabel>
        <Card style={{ gap: space[3] }}>
          <Field label="Clé API" value={key} onChangeText={setKey} placeholder="AIza…" secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <Txt kind="strong">{saved === null ? "…" : saved ? "Clé enregistrée sur cet appareil" : "Aucune clé enregistrée"}</Txt>
          <Txt kind="caption" muted>
            La clé reste sur cet appareil et n'est envoyée qu'à Gemini. Un appel par séance validée. Si Gemini ne répond pas, ou sans clé, le plan est calculé avec tes règles seules.
          </Txt>
          <ErrorText message={error} />
          {result ? <Txt kind="strong">{result}</Txt> : null}
          <Split>
            <Button label={testing ? "Test…" : "Tester"} kind="secondary" disabled={testing} onPress={test} />
            <Button label="Enregistrer" onPress={save} />
          </Split>
          {saved ? <Button label="Supprimer la clé" kind="ghost" small onPress={remove} /> : null}
        </Card>
      </View>
      <AppearanceCard />
      <DataCard />
    </Screen>
  );
}

const APPEARANCES: { id: AppearanceChoice; label: string }[] = [
  { id: "system", label: "Système" },
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
];

/** Apparence: follow the phone, or force the light or the dark theme. */
function AppearanceCard() {
  const [choice, setChoice] = useState<AppearanceChoice>("system");
  useEffect(() => {
    getAppearance().then(setChoice);
  }, []);
  const pick = (c: AppearanceChoice) => {
    setChoice(c);
    setAppearance(c).catch(() => {});
  };
  return (
    <View style={{ gap: space[2] }}>
      <SectionLabel>Thème</SectionLabel>
      <Split>
        {APPEARANCES.map((a) => (
          <Chip key={a.id} label={a.label} selected={a.id === choice} onPress={() => pick(a.id)} />
        ))}
      </Split>
      <Txt kind="caption" muted>« Système » suit le mode clair ou sombre du téléphone.</Txt>
    </View>
  );
}

/** Données: everything lives on this phone, so export regularly and re-import a JSON to restore. */
function DataCard() {
  const { repo, db } = useStore();
  const act = useAction();
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const share = (make: () => Promise<string>, title: string) => async () => {
    try {
      setError(null);
      await Share.share({ title, message: await make() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const restore = async () => {
    setDone(false);
    const ok = await act(() => importJson(db, text), setError);
    if (ok) {
      setError(null);
      setImporting(false);
      setText("");
      setDone(true);
    }
  };

  return (
    <>
      <View style={{ gap: space[2] }}>
        <SectionLabel>Données</SectionLabel>
        <Card style={{ gap: space[3] }}>
          <Txt>Tout reste sur ce téléphone. Exporte régulièrement : un téléphone perdu, c'est l'historique perdu.</Txt>
          <Split>
            <Button label="Export JSON" kind="secondary" onPress={share(() => exportJson(db), "coaching-export.json")} />
            <Button label="Export CSV" kind="secondary" onPress={share(() => exportCsv(db), "coaching-export.csv")} />
          </Split>
          <Button label="Importer un export JSON" kind="ghost" small onPress={() => { setImporting(true); setDone(false); setError(null); }} />
          {done ? <Txt kind="strong">Données restaurées.</Txt> : null}
          <ErrorText message={error} />
        </Card>
      </View>
      <Sheet visible={importing} title="Importer un export JSON" onClose={() => setImporting(false)}>
        <Txt muted>Colle le contenu d'un export JSON. Il remplace toutes les données actuelles de cette application ; l'historique validé reste figé.</Txt>
        <Field label="Contenu de l'export" value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} style={{ minHeight: 140, textAlignVertical: "top", paddingTop: 12 }} />
        <ErrorText message={error} />
        <Button label="Remplacer mes données" kind="danger" disabled={!text.trim()} onPress={restore} />
        <Button label="Annuler" kind="secondary" onPress={() => setImporting(false)} />
      </Sheet>
    </>
  );
}
