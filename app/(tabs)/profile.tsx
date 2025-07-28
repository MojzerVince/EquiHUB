import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ProfileScreen = () => {
  return (
    <View>
      <SafeAreaView style={styles.top_bar}>
        <Text style={styles.header}>My Profile</Text>
      </SafeAreaView>
      <ScrollView style={styles.viewPort}></ScrollView>
    </View>
  );
};

const data = [];

const styles = StyleSheet.create({
  top_bar: {
    backgroundColor: "#335C67",
    height: "16%",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    marginTop: -4,
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    height: "100%",
    marginTop: -80,
    borderRadius: 50,
  },
});

export default ProfileScreen;
