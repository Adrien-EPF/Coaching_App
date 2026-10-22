import React, { useEffect, useState } from "react";
import { Share, View } from "react-native";
import { AppearanceChoice, getAppearance, setAppearance } from "../config/appearance";
import { callGemini } from "../planner/geminiApi";
import { clearGeminiKey, getGeminiKey, setGeminiKey } from "../config/geminiKey";
import { exportCsv, exportJson, importJson } from "../data/backup";
import { useAction, useStore } from "../data/RepoContext";
import { Button, Card, Chip, ErrorText, Field, Row, Screen, Sheet, Txt } from "../ui/kit";

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

  return (
    <Screen title="Réglages">
      <AppearanceCard />
      <Card>
        <Txt kind="strong">{saved === null ? "…" : saved ? "Clé enregistrée sur cet appareil" : "Aucune clé enregistrée"}</Txt>
        <Txt kind="caption" muted>
          La clé reste sur cet appareil et n'est envoyée qu'à Gemini. Un appel par séance validée. Si Gemini ne répond pas, ou sans clé, le plan est calculé avec tes règles seules.
        </Txt>
      </Card>
      <View style={{ gap: 12 }}>
        <Field label="Clé API" value={key} onChangeText={setKey} placeholder="AIza…" secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <ErrorText message={error} />
        <Button label={testing ? "Test en cours…" : "Tester la clé"} kind="secondary" disabled={testing} onPress={test} />
        {result ? <Txt kind="strong">{result}</Txt> : null}
        <Row wrap={false}>
          <Button label="Enregistrer" onPress={save} />
          {saved ? <Button label="Supprimer la clé" kind="secondary" onPress={remove} /> : null}
        </Row>
      </View>
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
    <Card>
      <Txt kind="heading">Apparence</Txt>
      <Txt kind="caption" muted>« Système » suit le mode clair ou sombre du téléphone.</Txt>
      <Row>
        {APPEARANCES.map((a) => (
          <Chip key={a.id} label={a.label} selected={a.id === choice} onPress={() => pick(a.id)} />
        ))}
      </Row>
    </Card>
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
      <Card>
        <Txt kind="heading">Données</Txt>
        <Txt kind="caption" muted>
          Tout reste sur ce téléphone. Exporte régulièrement : un téléphone perdu, c'est l'historique perdu.
        </Txt>
        <Row wrap={false}>
          <Button label="Export JSON" kind="secondary" onPress={share(() => exportJson(db), "coaching-export.json")} />
          <Button label="Export CSV" kind="secondary" onPress={share(() => exportCsv(db), "coaching-export.csv")} />
        </Row>
        <Button label="Importer un export JSON" kind="secondary" onPress={() => { setImporting(true); setDone(false); setError(null); }} />
        {done ? <Txt kind="strong">Données restaurées.</Txt> : null}
        <ErrorText message={error} />
      </Card>
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
