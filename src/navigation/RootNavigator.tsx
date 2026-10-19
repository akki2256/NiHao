import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppIcon } from '../components/Icon';
import React from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconName, Loader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ContributorEditScreen } from '../screens/ContributorEditScreen';
import { ContributorsScreen } from '../screens/ContributorsScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { ExpenseFormScreen } from '../screens/ExpenseFormScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { BalancesScreen } from '../screens/BalancesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { ProjectFormScreen } from '../screens/ProjectFormScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { RecentlyDeletedScreen } from '../screens/RecentlyDeletedScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TaskFormScreen } from '../screens/TaskFormScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { sectionColors } from '../theme/colors';
import { useColors, useTheme } from '../theme/ThemeContext';
import { useLayout } from '../theme/useLayout';
import { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

type TabConfig = {
  label: string;
  icon: IconName;
  iconFocused: IconName;
  color: string;
};

const TAB_CONFIG: Record<keyof MainTabParamList, TabConfig> = {
  Projects: {
    label: 'Projects',
    icon: 'briefcase-outline',
    iconFocused: 'briefcase',
    color: sectionColors.projects,
  },
  Tasks: {
    label: 'Tasks',
    icon: 'checkbox-outline',
    iconFocused: 'checkbox',
    color: sectionColors.tasks,
  },
  Home: {
    label: 'Home',
    icon: 'home-outline',
    iconFocused: 'home',
    color: sectionColors.home,
  },
  Contributors: {
    label: 'Team',
    icon: 'people-outline',
    iconFocused: 'people',
    color: sectionColors.team,
  },
  Expenses: {
    label: 'Expenses',
    icon: 'wallet-outline',
    iconFocused: 'wallet',
    color: sectionColors.expenses,
  },
};

/** Content height of the tab bar, before the gesture-bar inset is added. */
const TAB_BAR_CONTENT_HEIGHT = 68;

function MainTabs() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isCompact, s } = useLayout();
  const iconSize = isCompact ? 26 : s(28);
  const labelSize = isCompact ? 12 : s(13);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const cfg = TAB_CONFIG[route.name];
        const accent = route.name === 'Home' && colors.bg !== '#0A0A0A' ? '#1A1A1A' : cfg.color;
        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
            height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          },
          tabBarItemStyle: { paddingHorizontal: 0 },
          tabBarLabel: ({ color, focused }) => (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              style={{
                color,
                fontSize: labelSize,
                fontWeight: focused ? '800' : '600',
                marginTop: 2,
              }}
            >
              {cfg.label}
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AppIcon
              name={focused ? cfg.iconFocused : cfg.icon}
              size={iconSize}
              color={color}
            />
          ),
        };
      }}
    >
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Contributors" component={ContributorsScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();
  const { mode } = useTheme();
  const colors = useColors();
  const base = mode === 'light' ? DefaultTheme : DarkTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.bgElevated,
      text: colors.text,
      border: colors.border,
      primary: colors.silverBright,
    },
  };

  if (loading) return <Loader />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.silverBright,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProjectDetail"
              component={ProjectDetailScreen}
              options={{ title: 'Project' }}
            />
            <Stack.Screen
              name="ProjectForm"
              component={ProjectFormScreen}
              options={{ title: 'Project form' }}
            />
            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ title: 'Task' }}
            />
            <Stack.Screen
              name="TaskForm"
              component={TaskFormScreen}
              options={{ title: 'Task form' }}
            />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: 'Expense' }}
            />
            <Stack.Screen
              name="ExpenseForm"
              component={ExpenseFormScreen}
              options={{ title: 'Expense form' }}
            />
            <Stack.Screen
              name="ContributorEdit"
              component={ContributorEditScreen}
              options={{ title: 'Edit profile' }}
            />
            <Stack.Screen
              name="RecentlyDeleted"
              component={RecentlyDeletedScreen}
              options={{ title: 'Recently deleted' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="Balances" component={BalancesScreen} options={{ title: 'Balances' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
