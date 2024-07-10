import React, { useContext, useState, useReducer, useEffect, useRef } from "react";
import avatar from "../../Assets/Images/avatar.jpg";
import { AuthContext } from "../AppContext/AppContext";
import {
  PostsReducer,
  postActions,
  postsStates,
} from "../AppContext/PostReducer";
import {
  doc,
  setDoc,
  collection,
  query,
  onSnapshot,
  where,
  getDocs,
  getDoc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import CommentSection from "./CommentSection";
import { formatDistanceToNow } from 'date-fns';
import { FaLink } from 'react-icons/fa';

const FullScreenComments = ({ postId, uid, close }) => {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto p-4">
      <button className="text-black mb-4" onClick={close}>
        ← Back to Post
      </button>
      <CommentSection open={true} setOpen={close} postId={postId} uid={uid} />
    </div>
  );
};

const PostCard = ({ uid, id, logo, name, email, text, image, timestamp }) => {
  const { user, userData } = useContext(AuthContext);
  const [state, dispatch] = useReducer(PostsReducer, postsStates);
  const likesRef = doc(collection(db, "posts", id, "likes"));
  const likesCollection = collection(db, "posts", id, "likes");
  const { ADD_LIKE, HANDLE_ERROR, ADD_COMMENT } = postActions;
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const singlePostDocument = doc(db, "posts", id);
  const commentButtonRef = useRef(null);
  const wordLimit = 20;

  const [profileDetails, setProfileDetails] = useState({
    firstName: '',
    secondName: '',
    personalPhone: '',
    businessName: '',
    businessDescription: '',
    businessEmail: '',
    businessPhone: '',
    profilePicture: '',
    profileCover: '',
  });

  useEffect(() => {
    const fetchProfileDetails = async () => {
      if (uid) {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileDetails(docSnap.data());
        } else {
          setProfileDetails({
            firstName: '',
            secondName: '',
            personalPhone: '',
            businessName: '',
            businessEmail: '',
            businessPhone: '',
            profilePicture: '',
            profileCover: '',
            businessDescription: '',
          });
        }
      }
    };

    fetchProfileDetails();
  }, [uid]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpen = (e) => {
    e.preventDefault();
    if (isMobileView) {
      setOpen(true);
    } else {
      setOpen(!open);
    }
  };

  const addUser = async () => {
    try {
      const q = query(collection(db, "users"), where("uid", "==", user?.uid));
      const doc = await getDocs(q);
      const data = doc.docs[0].ref;
      await updateDoc(data, {
        friends: arrayUnion({
          id: uid,
          image: user.photoURL,
          name: name,
        }),
      });
    } catch (err) {
      alert(err.message);
      console.log(err.message);
    }
  };

  const handleLike = async (e) => {
    e.preventDefault();
    const q = query(likesCollection, where("id", "==", user?.uid));
    const querySnapshot = await getDocs(q);
    const likesDocId = await querySnapshot?.docs[0]?.id;

    try {
      if (likesDocId !== undefined) {
        const deleteId = doc(db, "posts", id, "likes", likesDocId);
        await deleteDoc(deleteId);
      } else {
        await setDoc(likesRef, {
          id: user?.uid,
        });
        await addNotification("like", `${user.displayName} liked your post`, uid, id);
      }
    } catch (err) {
      alert(err.message);
      console.log(err.message);
    }
  };

  const addNotification = async (type, message, userId, postId) => {
    try {
      await addDoc(collection(db, "notifications"), {
        userId,
        type,
        postId,
        message,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Error adding notification: ", err);
    }
  };

  const deletePost = async (e) => {
    e.preventDefault();
    try {
      if (user?.uid === uid) {
        await deleteDoc(singlePostDocument);
      } else {
        alert("You can't delete other users' posts !!!");
      }
    } catch (err) {
      alert(err.message);
      console.log(err.message);
    }
  };

  useEffect(() => {
    const getLikes = async () => {
      try {
        const q = collection(db, "posts", id, "likes");
        await onSnapshot(q, (doc) => {
          dispatch({
            type: ADD_LIKE,
            likes: doc.docs.map((item) => item.data()),
          });
        });
      } catch (err) {
        dispatch({ type: HANDLE_ERROR });
        alert(err.message);
        console.log(err.message);
      }
    };
    const getComments = async () => {
      try {
        const q = collection(db, "posts", id, "comments");
        await onSnapshot(q, (doc) => {
          dispatch({
            type: ADD_COMMENT,
            comments: doc.docs.map((item) => item.data()),
          });
        });
      } catch (err) {
        dispatch({ type: HANDLE_ERROR });
        alert(err.message);
        console.log(err.message);
      }
    };
    getLikes();
    getComments();
  }, [id, ADD_LIKE, ADD_COMMENT, HANDLE_ERROR]);

  const formatTimestamp = (timestamp) => {
    try {
      if (!timestamp) return ''; // Handle case where timestamp is null or undefined

      let date;
      if (timestamp.toDate) {
        date = timestamp.toDate(); // Assuming timestamp is a Firestore Timestamp
      } else {
        date = new Date(timestamp); // Fallback for other cases (e.g., JavaScript Date)
      }

      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid Date'; // or handle it differently based on your UI requirements
    }
  };

  const truncateText = (text, wordLimit) => {
    const words = text.split(' ');
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(' ') + '...';
    }
    return text;
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${id}`;
    navigator.clipboard.writeText(postUrl)
      .then(() => alert("Post link copied to clipboard!"))
      .catch((err) => console.error("Failed to copy link: ", err));
  };

  return (
    <>
      <div className="flex flex-col mb-4 md:mx-8 flex justify-center">
        <div className="flex flex-col py-4 bg-white border border-gray-300 md:rounded-md w-full md:max-w-2xl md:shadow-md">
          <div className="flex items-center py-2 md:py-4 px-5 md:px-4">
            <img
              className="w-8 h-8 rounded-full"
              src={profileDetails.profilePicture  || avatar}
              alt="avatar"
            />

            <div className="flex flex-col ml-4 w-full">
              <p className="font-sans font-semibold text-base md:text-sm text-gray-900">
              {profileDetails.firstName} {profileDetails.secondName }
              </p>
              <div className="flex items-center">
                <p className="font-sans font-semibold mr-1 text-base md:text-xs text-gray-900">
                  {profileDetails.businessName} --
                </p>
                <p className="font-sans font-normal text-xs pt-1 text-gray-700">
                  Published: {formatTimestamp(timestamp)}
                </p>
              </div>
            </div>
            {user?.uid !== uid && (
              <div onClick={addUser} className="cursor-pointer ml-auto">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 fill-green-700 hover:fill-green-500">
                  <path d="M5.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM2.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM18.75 7.5a.75.75 0 0 0-1.5 0v2.25H15a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H21a.75.75 0 0 0 0-1.5h-2.25V7.5Z" />
                </svg>
              </div>
            )}
          </div>
          <div className="text-left py-1 md:py-3 px-5 md:px-4">
            <p className="font-sans text-sm md:text-base text-gray-900">
              {isExpanded ? text : truncateText(text, wordLimit)}
              {text.split(' ').length > wordLimit && !isExpanded && (
                <span
                  className="text-blue-500 cursor-pointer"
                  onClick={() => setIsExpanded(true)}
                >
                  see more
                </span>
              )}
            </p>
          </div>

          <div>
            {image && (
              <img
                src={image}
                alt="post-image"
                className="w-full h-auto object-cover"
              />
            )}
          </div>

          <div className="flex items-center justify-between px-5 md:mx-8 md:px-4 border-t border-gray-200 py-2 mt-2 md:py-2">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div
                onClick={handleLike}
                className="cursor-pointer flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor" viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  className={`w-4 h-4 ${state.likes.some((like) => like.id === user?.uid)
                    ? "fill-green-700"
                    : "fill-gray-700"
                    } hover:fill-green-500`}
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                </svg>
                <span className="ml-1 text-sm text-gray-700">
                  {state.likes.length}
                </span>
              </div>

              <div className="cursor-pointer flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 fill-green-700 hover:fill-green-500"
                  onClick={handleOpen}
                  ref={commentButtonRef}
                >
                  <path d="M12 2.25c-5.385 0-9.75 3.97-9.75 8.857 0 2.125.822 4.096 2.198 5.633a10.966 10.966 0 0 1-1.948 3.89.75.75 0 0 0 1.192.916c2.165-2.14 3.906-1.57 6.598-2.403a11.471 11.471 0 0 0 1.71.127c5.385 0 9.75-3.97 9.75-8.857S17.385 2.25 12 2.25Z" />
                </svg>
                <span className="ml-1 text-sm text-gray-700">
                  {state.comments.length}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button onClick={handleCopyLink} className=" flex items-center gap-2  text-gray-600 hover:text-gray-900">
                <FaLink className="w-4 h-4 text-green-700" />
                <span>
                  <p className="text-sm">Copy to Share</p>
                </span>
              </button>
            </div>

            <div className="cursor-pointer">
              {user?.uid === uid && (
                <svg
                  onClick={deletePost}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 fill-red-700 hover:fill-red-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.5 4.5V3.75A2.25 2.25 0 0 1 9.75 1.5h4.5A2.25 2.25 0 0 1 16.5 3.75V4.5h3.75a.75.75 0 0 1 0 1.5h-.891l-.789 12.623A2.25 2.25 0 0 1 16.325 21H7.674a2.25 2.25 0 0 1-2.245-2.377L4.64 6H3.75a.75.75 0 0 1 0-1.5H7.5Zm1.5-1.5v1.5h6V3.75a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0-.75.75ZM6.14 6l.749 12.004a.75.75 0 0 0 .748.746h8.65a.75.75 0 0 0 .748-.746L17.84 6H6.14Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
        {open && !isMobileView && (
          <div className="bg-white shadow-md rounded-md mt-2 w-full md:max-w-2xl p-4">
            <CommentSection open={open} setOpen={setOpen} postId={id} uid={uid} />
          </div>
        )}
      </div>
      {isMobileView && open && (
        <FullScreenComments postId={id} uid={uid} close={() => setOpen(false)} />
      )}
    </>
  );
};

export default PostCard;
