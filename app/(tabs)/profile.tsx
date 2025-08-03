import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ProfileScreen = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView>
        <Text style={styles.header}>My Profile</Text>
      </SafeAreaView>

      <ScrollView style={styles.viewPort}>
        <View style={styles.profileContainer}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <View style={styles.profileImageContainer}>
              <Image
                source={require("../../assets/images/horses/falko.png")} // Using placeholder image
                style={styles.profileImage}
              />
            </View>

            <Text style={styles.userName}>Vince Mojzer</Text>
            <Text style={styles.userAge}>18</Text>
            <Text style={styles.userDescription}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore
            </Text>
          </View>

          {/* Photo Gallery Section */}
          <View style={styles.gallerySection}>
            <Text style={styles.galleryTitle}>Photo Gallery</Text>
            <View style={styles.galleryGrid}>
              <View style={styles.galleryItem}></View>
              <View style={styles.galleryItem}></View>
              <View style={styles.galleryItem}></View>
              <View style={styles.galleryItem}></View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const data = [];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    marginBottom: -30,
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingTop: 30,
  },
  profileContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
    backgroundColor: "#E9F5F0",
    borderRadius: 30,
    padding: 30,
    position: "relative",
  },
  editButton: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
    zIndex: 1,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  profileImageContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#335C67",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 5,
    fontFamily: "Inder",
  },
  userAge: {
    fontSize: 20,
    color: "#335C67",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  userDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
    fontFamily: "Inder",
  },
  gallerySection: {
    marginBottom: 30,
  },
  galleryTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Inder",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 20,
  },
  galleryItem: {
    width: 150,
    height: 150,
    backgroundColor: "#C5D9D1",
    borderRadius: 15,
    marginBottom: 10,
  },
});

export default ProfileScreen;
