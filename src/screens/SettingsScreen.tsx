import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { clearGeminiKey, getGeminiKey, setGeminiKey } from "../config/geminiKey";
import { Button, Card, ErrorText, Field, Row, Screen, Txt } from "../ui/kit";

/** Réglages: the Gemini API key, kept on this device only. */
export function SettingsScreen() {
  const navigation = useNavigation();
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
    <Screen title="Réglages" subtitle="Gemini" right={<Button label="Fermer" kind="secondary" small onPress={() => navigation.goBack()} />}>
      <Card>
        <Txt kind="strong">{saved === null ? "…" : saved ? "Clé enregistrée sur cet appareil" : "Aucune clé enregistrée"}</Txt>
        <Txt kind="caption" muted>
          La clé reste sur cet appareil et n'est envoyée qu'à Gemini. Un appel par séance validée. Si Gemini ne répond pas, ou sans clé, le plan est calculé avec tes règles seules.
        </Txt>
      </Card>
      <View style={{ gap: 12 }}>
        <Field label="Clé API" value={key} onChangeText={setKey} placeholder="AIza…" secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <ErrorText message={error} />
        <Row wrap={false}>
          <Button label="Enregistrer" onPress={save} />
          {saved ? <Button label="Supprimer la clé" kind="secondary" onPress={remove} /> : null}
        </Row>
      </View>
    </Screen>
  );
}
