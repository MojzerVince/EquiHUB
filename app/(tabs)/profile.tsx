import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ProfileScreen = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("Vince Mojzer");
  const [userAge, setUserAge] = useState("18");
  const [userDescription, setUserDescription] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
  );

  const handleEditPress = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (userName.trim() === "") {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    if (userAge.trim() === "" || isNaN(Number(userAge))) {
      Alert.alert("Error", "Please enter a valid age");
      return;
    }
    setIsEditing(false);
    Alert.alert("Success", "Profile updated successfully!");
  };

  const handleCancel = () => {
    // Reset to original values
    setUserName("Vince Mojzer");
    setUserAge("18");
    setUserDescription(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
    );
    setIsEditing(false);
  };
  return (
    <View style={styles.container}>
      <SafeAreaView>
        <Text style={styles.header}>My Profile</Text>
      </SafeAreaView>

      <ScrollView style={styles.viewPort}>
        <View style={styles.profileContainer}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            {!isEditing ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditPress}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editButtonsContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.profileImageContainer}>
              <Image
                source={require("../../assets/images/horses/falko.png")} // Using placeholder image
                style={styles.profileImage}
              />
            </View>

            {!isEditing ? (
              <>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userAge}>{userAge}</Text>
                <Text style={styles.userDescription}>{userDescription}</Text>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.editInput}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={styles.editInput}
                  value={userAge}
                  onChangeText={setUserAge}
                  placeholder="Enter your age"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.editInput, styles.editDescriptionInput]}
                  value={userDescription}
                  onChangeText={setUserDescription}
                  placeholder="Enter your description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </>
            )}
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
  editButtonsContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "row",
    gap: 10,
    zIndex: 1,
  },
  cancelButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  editInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#335C67",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
    fontFamily: "Inder",
    color: "#335C67",
    textAlign: "center",
    minWidth: 200,
  },
  editDescriptionInput: {
    textAlign: "left",
    minHeight: 80,
    textAlignVertical: "top",
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
