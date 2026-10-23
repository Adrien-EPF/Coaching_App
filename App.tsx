import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from "@expo-google-fonts/barlow";
import { SofiaSansCondensed_600SemiBold, SofiaSansCondensed_700Bold, SofiaSansCondensed_800ExtraBold } from "@expo-google-fonts/sofia-sans-condensed";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { applyAppearance, getAppearance } from "./src/config/appearance";
import { RepoProvider } from "./src/data/RepoContext";
import type { RootParams } from "./src/navigation";
import { LogScreen } from "./src/screens/LogScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { ProgramScreen } from "./src/screens/ProgramScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { Icon, IconName } from "./src/ui/icons";
import { fonts, radius, useColors, useIsDark } from "./src/ui/theme";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootParams>();

function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }}>
      <ActivityIndicator color={c.ink} />
    </View>
  );
}

const TAB_ICONS: Record<string, IconName> = {
  "Séance": "session",
  Calendrier: "calendar",
  Programme: "list",
  "Progrès": "trend",
};

function Tabs() {
  const c = useColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.inkMuted,
        tabBarLabel: ({ color, children }) => (
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color }}>{children}</Text>
        ),
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              width: 56,
              height: 32,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: focused ? c.contrast : "transparent",
            }}
          >
            <Icon name={TAB_ICONS[route.name]} color={focused ? c.onContrast : c.inkMuted} size={22} />
          </View>
        ),
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 76, paddingTop: 8, paddingBottom: 8 },
        tabBarItemStyle: { gap: 2 },
      })}
    >
      <Tab.Screen name="Séance" component={TodayScreen} />
      <Tab.Screen name="Calendrier" component={CalendarScreen} />
      <Tab.Screen name="Programme" component={ProgramScreen} />
      <Tab.Screen name="Progrès" component={ProgressScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const c = useColors();
  const dark = useIsDark();
  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer theme={{ ...base, colors: { ...base.colors, background: c.surface, card: c.surfaceRaised, text: c.ink, border: c.line, primary: c.ink } }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Log" component={LogScreen} />
        <Stack.Screen name="Réglages" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [loaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    SofiaSansCondensed_600SemiBold,
    SofiaSansCondensed_700Bold,
    SofiaSansCondensed_800ExtraBold,
  });
  const [appearanceReady, setAppearanceReady] = useState(false);
  useEffect(() => {
    getAppearance().then((choice) => {
      applyAppearance(choice);
      setAppearanceReady(true);
    });
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {loaded && appearanceReady ? (
        <RepoProvider fallback={<Loading />}>
          <Root />
        </RepoProvider>
      ) : (
        <Loading />
      )}
    </SafeAreaProvider>
  );
}
